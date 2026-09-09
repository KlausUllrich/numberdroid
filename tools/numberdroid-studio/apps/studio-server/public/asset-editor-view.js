import { isEmbeddedGeometry, embeddedRegion, embeddedFramePoints } from './asset-embedded-geometry.js';
import { createAssemblyArtwork } from './assembly-artwork-view.js';
import { assetEditorDirty, assetEditorIssues, selectedAssetRegion } from './asset-editor-state.js';
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const svg = (tag, attributes = {}) => { const n = document.createElementNS(NS, tag); for (const [key, value] of Object.entries(attributes)) n.setAttribute(key, String(value)); return n; };
const button = (text, action, value = '') => { const n = el('button', 'secondary', text); n.type = 'button'; n.dataset.assetEditorAction = action; if (value) n.dataset.value = value; n.dataset.assetEditorFocusKey = `${action}:${value}`; return n; };
const label = (text, control) => { const n = el('label', 'asset-editor-field'); n.append(el('span', '', text), control); return n; };
const number = (key, value, caption) => { const n = el('input'); n.type = 'number'; n.step = 'any'; n.value = String(value); n.dataset.assetEditorField = key; n.dataset.assetEditorFocusKey = `field:${key}`; return label(caption, n); };
const text = (key, value, caption) => { const n = el('input'); n.type = 'text'; n.value = value ?? ''; n.maxLength = key === 'name' ? 160 : 100; n.dataset.assetEditorField = key; n.dataset.assetEditorFocusKey = `field:${key}`; return label(caption, n); };
const choice = (key, value, caption, options) => { const n = el('select'); n.dataset.assetEditorField = key; n.dataset.assetEditorFocusKey = `field:${key}`; for (const [v, name] of options) { const o = el('option', '', name); o.value = v; n.append(o); } n.value = String(value ?? ''); return label(caption, n); };
const checkbox = (key, value, caption) => { const n = el('input'); n.type = 'checkbox'; n.checked = value; n.dataset.assetEditorOption = key; n.dataset.assetEditorFocusKey = `option:${key}`; return label(caption, n); };
export function assetEditorFrame(state) {
  const size = state.initial.pixelSize; const s = state.model.spatial; const points = [{ x: 0, y: 0 }, { x: size.width, y: size.height }, s.anchor,
    { x: s.placementBounds.x, y: s.placementBounds.y }, { x: s.placementBounds.x + s.placementBounds.width, y: s.placementBounds.y + s.placementBounds.height }];
  for (const r of s.blockingRegions) { const q = r.shape; if (q.kind === 'polygon') points.push(...q.points); else points.push({ x: q.x, y: q.y }, { x: q.x + q.width, y: q.y + q.height }); }
  if (isEmbeddedGeometry(state)) points.push(...embeddedFramePoints(state));
  const finite = points.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)); const minX = Math.min(...finite.map(p => p.x)), minY = Math.min(...finite.map(p => p.y));
  const width = Math.max(1, Math.max(...finite.map(p => p.x)) - minX), height = Math.max(1, Math.max(...finite.map(p => p.y)) - minY); const pad = Math.max(width, height) * .06;
  return { x: minX - pad, y: minY - pad, width: width + pad * 2, height: height + pad * 2 };
}
export function createAssetEditorView(state) {
  const root = el('section', 'asset-editor'); root.dataset.assetEditor = state.instanceId; const embedded = isEmbeddedGeometry(state);
  const header = el('header', 'asset-editor-header'); const heading = el('div'); heading.append(el('p', 'eyebrow', embedded ? 'Assembly / Custom blocking' : state.context.assetVersion ? 'Library / Edit Asset' : 'Saved image / Create Asset'));
  const title = el('h2'); title.dataset.assetEditorTitle = ''; heading.append(title, el('p', 'asset-editor-intro', embedded ? 'Edit the Assembly’s owned blocking. Return keeps this draft, including an unfinished outline; save from the Assembly.' : 'Define what the image is and the space it uses. Your Save adds a draft Asset directly to the Library.'));
  header.append(heading, button(state.initial.returnLabel ?? 'Back to Library', 'back')); root.append(header);
  const tabs = el('nav', 'asset-editor-tabs'); tabs.setAttribute('aria-label', 'Asset editor views'); tabs.append(button('Placement & blocking', 'view', 'edit'), ...(embedded ? [] : [button('Properties', 'view', 'properties')]), button('Preview shapes', 'view', 'preview')); root.append(tabs);
  const status = el('div', 'asset-editor-status'); status.dataset.assetEditorStatus = ''; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); root.append(status);
  const recovery = el('div', 'asset-editor-recovery'); recovery.dataset.assetEditorRecovery = ''; root.append(recovery);
  const edit = el('div', 'asset-editor-layout'); edit.dataset.assetEditorView = 'edit';
  const rail = el('nav', 'asset-editor-tools'); rail.setAttribute('aria-label', 'Placement and blocking tools');
  for (const [tool, name] of [['select', 'Select'], ['polygon', 'Polygon'], ['rectangle', 'Rectangle'], ['oval', 'Oval'], ['insert', 'Point +'], ['remove', 'Remove'], ['grid', 'Grid'], ['undo', 'Undo'], ['redo', 'Redo']]) { const b = button(name, 'tool', tool); b.dataset.assetEditorTool = tool; rail.append(b); } rail.append(button(embedded ? 'Return' : 'Save work', embedded ? 'back' : 'save'));
  const main = el('div', 'asset-editor-main'); const zoom = el('div', 'asset-editor-zoom'); zoom.append(button('Fit', 'zoom', 'fit'), button('100%', 'zoom', '1'));
  const slider = el('input'); slider.type = 'range'; slider.min = '10'; slider.max = '400'; slider.step = '1'; slider.setAttribute('aria-label', 'Asset canvas zoom percent'); slider.dataset.assetEditorZoom = ''; slider.dataset.assetEditorFocusKey = 'zoom'; const output = el('output'); output.dataset.assetEditorZoomLabel = ''; zoom.append(slider, output); main.append(zoom);
  const scroll = el('div', 'asset-editor-scroll'); scroll.dataset.assetEditorScroll = 'canvas'; const stage = el('div', 'asset-editor-stage');
  const canvas = svg('svg', { tabindex: 0, role: 'group', 'aria-label': 'Asset artwork, blocking regions, placement bounds and anchor' }); canvas.dataset.assetEditorCanvas = ''; canvas.dataset.assetEditorFocusKey = 'canvas';
  const image = embedded ? createAssemblyArtwork(state.initial.artworkScene, { projectId: state.context.projectId }) : svg('image', { href: state.initial.previewUrl, x: 0, y: 0, width: state.initial.pixelSize.width, height: state.initial.pixelSize.height }); image.dataset.assetEditorArtwork = ''; canvas.append(image);
  for (const layer of ['grid', 'bounds', 'regions', 'draft', 'anchor']) { const group = svg('g'); group.dataset.assetEditorLayer = layer; canvas.append(group); }
  stage.append(canvas); scroll.append(stage); main.append(scroll);
  main.append(el('p', 'asset-editor-legend', embedded ? 'Assembly blocking · blue placement bounds · cyan anchor. Coordinates use the Assembly pixel plane.' : 'Blocking · blue dashed placement bounds · cyan alignment anchor. Coordinates use image pixels.'));
  const inspector = el('aside', 'asset-editor-inspector'); inspector.dataset.assetEditorScroll = 'inspector'; edit.append(rail, main, inspector); root.append(edit);
  const properties = el('section', 'asset-editor-properties'); properties.dataset.assetEditorView = 'properties'; root.append(properties);
  const preview = el('section', 'asset-editor-preview'); preview.dataset.assetEditorView = 'preview'; root.append(preview);
  const popup = el('section', 'asset-editor-grid-popup'); popup.dataset.assetEditorGridPopup = ''; popup.setAttribute('role', 'dialog'); popup.setAttribute('aria-label', 'Grid and view'); popup.append(el('h3', '', 'Grid & view'), button('Close', 'close-grid'), checkbox('grid.show', false, 'Show grid guides'), checkbox('grid.snap', false, 'Snap drawing and dragging'));
  popup.append(number('grid.step', state.grid.step, 'Grid spacing in image pixels'), el('p', '', 'Alt bypasses snapping. Grid changes leave saved geometry unchanged.'), checkbox('visibility.image', true, 'Show artwork'), checkbox('visibility.bounds', true, 'Show placement bounds'), checkbox('visibility.anchor', true, 'Show alignment anchor')); root.append(popup);
  const footer = el('footer', 'asset-editor-footer'); const saved = el('span'); saved.dataset.assetEditorSavedState = ''; footer.append(saved, button('Close polygon', 'finish-polygon'), button(embedded ? 'Keep geometry draft' : 'Save Asset', embedded ? 'back' : 'save')); root.append(footer);
  return root;
}
function inspectorContent(state) {
  const box = el('div'); const tabs = el('nav', 'asset-editor-panel-tabs'); tabs.append(button('Blocking', 'panel', 'blocking'), button('Placement', 'panel', 'placement')); box.append(tabs);
  if (!state.model.geometryEnabled) { box.append(el('p', 'asset-editor-note', 'This Asset uses its saved legacy geometry. Editing its name or properties preserves that geometry.'), button('Edit placement & blocking', 'enable-geometry')); return box; }
  const s = state.model.spatial;
  if (Object.hasOwn(state.model.metadata.extensions ?? {}, 'studio.preview.presentation')) box.append(el('p', 'asset-editor-note', 'This Asset has an older Preview layout. Resolve it explicitly before using the authored geometry.'), button('Use authored geometry for Preview', 'resolve-presentation'));
  if (state.panel === 'placement') {
    box.append(el('h3', '', 'Placement bounds'), el('p', 'asset-editor-note', 'Positioning space, separate from blocking. Changing bounds leaves the artwork and shapes fixed.'));
    const coordinates = el('div', 'asset-editor-coordinates'); for (const [key, name] of [['x', 'Left'], ['y', 'Top'], ['width', 'Width'], ['height', 'Height']]) coordinates.append(number(`placement.${key}`, s.placementBounds[key], `${name} (px)`)); box.append(coordinates, el('h3', '', 'Alignment anchor'));
    const anchor = el('div', 'asset-editor-coordinates'); anchor.append(number('anchor.x', s.anchor.x, 'X (px)'), number('anchor.y', s.anchor.y, 'Y (px)')); box.append(anchor, button('Set anchor on canvas', 'tool', 'anchor'), el('h3', '', isEmbeddedGeometry(state) ? 'Assembly scale' : 'Image scale'));
    box.append(number('scale.x', s.unitsPerPixel.x, isEmbeddedGeometry(state) ? 'Project units per Assembly pixel' : 'Project units per image pixel · X'), ...(isEmbeddedGeometry(state) ? [] : [number('scale.y', s.unitsPerPixel.y, 'Project units per image pixel · Y')]), el('p', 'asset-editor-note', 'Bounds change positioning space. Scale changes the physical size of artwork and shapes together.'));
    return box;
  }
  box.append(el('h3', '', 'Blocking regions')); const list = el('div', 'asset-editor-regions'); list.dataset.assetEditorScroll = 'regions';
  for (const region of s.blockingRegions) { const b = button(region.name || 'Unnamed region', 'region', region.regionId); b.dataset.assetEditorRegionSelect = region.regionId; b.setAttribute('aria-pressed', String(region.regionId === state.selectedRegionId)); b.append(el('small', '', region.shape.kind === 'polygon' ? `${region.shape.points.length} points · polygon` : region.shape.kind)); list.append(b); }
  box.append(list); const region = selectedAssetRegion(state);
  if (!region) { box.append(el('p', 'asset-editor-note', 'Draw a polygon, rectangle or oval to add blocking. Empty regions mean no blocking.')); return box; }
  box.append(text('region.name', region.name, 'Region name'));
  const shape = region.shape;
  if (shape.kind === 'polygon') {
    const points = el('div', 'asset-editor-points'); shape.points.forEach((p, i) => { const b = button(String(i + 1), 'point', String(i)); b.setAttribute('aria-label', `Select polygon point ${i + 1}`); b.setAttribute('aria-pressed', String(state.selectedPoint === i)); points.append(b); }); box.append(points);
    const point = shape.points[state.selectedPoint]; if (point) { const coords = el('div', 'asset-editor-coordinates'); coords.append(number('point.x', point.x, `Point ${state.selectedPoint + 1} X`), number('point.y', point.y, `Point ${state.selectedPoint + 1} Y`)); box.append(coords); }
    box.append(el('p', 'asset-editor-note', 'Point + inserts on an edge. Remove deletes the selected point.'));
    const details = el('details'); details.append(el('summary', '', 'All point coordinates')); const table = el('table'); shape.points.forEach((p, i) => { const row = el('tr'); for (const value of [i + 1, p.x, p.y]) row.append(el('td', '', String(value))); table.append(row); }); details.append(table); box.append(details);
  } else {
    const coords = el('div', 'asset-editor-coordinates'); const oval = shape.kind === 'oval';
    coords.append(number(oval ? 'oval.cx' : 'region.x', oval ? shape.x + shape.width / 2 : shape.x, oval ? 'Center X' : 'Left'), number(oval ? 'oval.cy' : 'region.y', oval ? shape.y + shape.height / 2 : shape.y, oval ? 'Center Y' : 'Top'), number('region.width', shape.width, 'Width'), number('region.height', shape.height, 'Height')); box.append(coords, el('p', 'asset-editor-note', 'Edge handles change one axis; corners change both. Shift makes a square or circle.'));
  }
  box.append(button('Remove whole region', 'remove-region')); return box;
}
function propertiesContent(state) {
  const box = el('div', 'asset-editor-property-grid'); const m = state.model.metadata;
  box.append(text('name', state.model.name, 'Asset name'), choice('kind', state.model.kind, 'Asset kind', [['surface', 'Surface'], ['prop', 'Prop'], ['item', 'Item']]), text('metadata.role', m.role, 'Purpose'),
    choice('metadata.attachment', m.attachment, 'Attaches to', [['ground', 'Ground'], ['wall', 'Wall'], ['ceiling', 'Ceiling'], ['free', 'Free']]), choice('metadata.rotationPolicy', m.rotationPolicy, 'Allowed rotations', [['fixed', 'One fixed direction'], ['cardinal', 'Four directions']]),
    choice('metadata.placement.wallSafe', m.placement.wallSafe, 'Room boundary suitability', [['false', 'Keep away from boundaries'], ['true', 'May touch boundaries']]),
    choice('metadata.navigation.effect', m.navigation.effect, 'Movement', [['passable', 'Can be crossed'], ['blocked', 'Blocked by authored regions'], ['cost', 'Movement cost']]),
    choice('metadata.visualWeight', m.visualWeight, 'Visual prominence', [['light', 'Light'], ['medium', 'Medium'], ['heavy', 'Heavy']]), choice('metadata.runtimeEligible', m.runtimeEligible, 'Intended use', [['false', 'Studio-only for now'], ['true', 'Intended for game use · does not publish']]));
  if (m.navigation.effect === 'cost') box.append(number('metadata.navigation.cost', m.navigation.cost ?? 1, 'Movement cost'));
  box.append(el('p', 'asset-editor-note', 'Saving creates a new draft version. Existing Rooms keep the Asset versions they already use. Other saved metadata stays intact.'));
  return box;
}
function shapeNode(shape, attributes = {}) {
  if (shape.kind === 'polygon') return svg('polygon', { points: shape.points.map(p => `${p.x},${p.y}`).join(' '), ...attributes });
  if (shape.kind === 'oval') return svg('ellipse', { cx: shape.x + shape.width / 2, cy: shape.y + shape.height / 2, rx: Math.max(0, shape.width / 2), ry: Math.max(0, shape.height / 2), ...attributes });
  return svg('rect', { x: shape.x, y: shape.y, width: Math.max(0, shape.width), height: Math.max(0, shape.height), ...attributes });
}
export function syncAssetEditorCanvas(root, state) {
  const canvas = root.querySelector('[data-asset-editor-canvas]'); const viewport = root.querySelector('[data-asset-editor-scroll="canvas"]');
  state.frame ??= assetEditorFrame(state); const frame = state.frame;
  const scale = state.gesture?.scale ?? (state.zoom === 'fit' ? Math.max(.001, Math.min(1, (viewport.clientWidth - 24) / frame.width, (viewport.clientHeight - 24) / frame.height)) : Number(state.zoom)); state.scale = scale;
  canvas.setAttribute('viewBox', `${frame.x} ${frame.y} ${frame.width} ${frame.height}`); canvas.style.width = `${frame.width * scale}px`; canvas.style.height = `${frame.height * scale}px`; canvas.dataset.scale = String(scale);
  canvas.dataset.tool = state.tool; root.querySelector('[data-asset-editor-artwork]').style.display = state.visibility.image ? '' : 'none';
  root.querySelector('[data-asset-editor-zoom-label]').textContent = `${state.zoom === 'fit' ? 'Fit · ' : ''}${Math.round(scale * 100)}%`;
  const range = root.querySelector('[data-asset-editor-zoom]'); if (document.activeElement !== range) range.value = String(Math.round(scale * 100));
  const layer = name => canvas.querySelector(`[data-asset-editor-layer="${name}"]`); const s = state.model.spatial;
  const bounds = svg('rect', { ...s.placementBounds, class: 'asset-editor-bounds' }); layer('bounds').replaceChildren(...(state.visibility.bounds ? [bounds] : []));
  const nodes = [];
  for (const region of s.blockingRegions) { const selected = region.regionId === state.selectedRegionId; const shape = shapeNode(region.shape, { class: `asset-editor-region${selected ? ' selected' : ''}`, 'data-asset-editor-region': region.regionId }); const regionNodes = []; const sink = isEmbeddedGeometry(state) ? regionNodes : nodes; sink.push(shape);
    if (!selected) { if (isEmbeddedGeometry(state)) { const group = svg('g', { transform: `matrix(${embeddedRegion(state, region).transform.join(' ')})` }); group.append(...regionNodes); nodes.push(group); } continue; } const r = region.shape; const radius = 5 / scale;
    if (r.kind === 'polygon') r.points.forEach((p, i) => { sink.push(svg('circle', { cx: p.x, cy: p.y, r: radius, class: `asset-editor-point${state.selectedPoint === i ? ' selected' : ''}`, 'data-asset-editor-point': i, 'data-asset-editor-region': region.regionId })); const n = svg('text', { x: p.x + radius * 1.8, y: p.y - radius * 1.5, 'font-size': 11 / scale, class: 'asset-editor-point-number' }); n.textContent = String(i + 1); sink.push(n); });
    else for (const edge of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) { const x = edge.includes('w') ? r.x : edge.includes('e') ? r.x + r.width : r.x + r.width / 2; const y = edge.includes('n') ? r.y : edge.includes('s') ? r.y + r.height : r.y + r.height / 2; sink.push(svg('rect', { x: x - radius, y: y - radius, width: radius * 2, height: radius * 2, class: 'asset-editor-handle', 'data-asset-editor-handle': edge, 'data-asset-editor-region': region.regionId })); }
    if (isEmbeddedGeometry(state)) { const group = svg('g', { transform: `matrix(${embeddedRegion(state, region).transform.join(' ')})` }); group.append(...regionNodes); nodes.push(group); }
  }
  layer('regions').replaceChildren(...nodes);
  const draftNodes = []; if (state.polygonDraft.length) { draftNodes.push(svg('polyline', { points: [...state.polygonDraft, ...(state.cursor ? [state.cursor] : [])].map(p => `${p.x},${p.y}`).join(' '), class: 'asset-editor-draft' })); state.polygonDraft.forEach((p, i) => draftNodes.push(svg('circle', { cx: p.x, cy: p.y, r: 5 / scale, class: 'asset-editor-point', 'data-asset-editor-draft-point': i }))); } layer('draft').replaceChildren(...draftNodes);
  const anchor = svg('g', { class: 'asset-editor-anchor', 'data-asset-editor-anchor': '' }); anchor.append(svg('circle', { cx: s.anchor.x, cy: s.anchor.y, r: 9 / scale }), svg('path', { d: `M${s.anchor.x - 13 / scale} ${s.anchor.y}h${26 / scale}M${s.anchor.x} ${s.anchor.y - 13 / scale}v${26 / scale}` })); layer('anchor').replaceChildren(...(state.visibility.anchor ? [anchor] : []));
  const lines = []; if (state.grid.show && Number.isFinite(state.grid.step) && state.grid.step > 0) { const step = Math.max(state.grid.step, Math.max(frame.width, frame.height) / 2000); for (let x = Math.ceil(frame.x / step) * step; x <= frame.x + frame.width; x += step) lines.push(`M${x} ${frame.y}v${frame.height}`); for (let y = Math.ceil(frame.y / step) * step; y <= frame.y + frame.height; y += step) lines.push(`M${frame.x} ${y}h${frame.width}`); } layer('grid').replaceChildren(svg('path', { d: lines.join(' '), class: 'asset-editor-grid' }));
}
export function updateAssetEditorView(root, state, { inspector = true } = {}) {
  root.querySelector('[data-asset-editor-title]').textContent = state.model.name || 'New Asset';
  for (const section of root.querySelectorAll('[data-asset-editor-view]')) section.hidden = section.dataset.assetEditorView !== state.view;
  const locked = ['saving', 'uncertain', 'checking'].includes(state.save.status); const issues = assetEditorIssues(state); const status = root.querySelector('[data-asset-editor-status]');
  status.textContent = state.error || state.conflict || (state.save.status === 'saving' ? 'Saving this exact Asset version…' : state.save.status === 'checking' ? 'Checking the saved outcome…' : state.polygonDraft.length ? `Polygon: ${state.polygonDraft.length} points. Click its first point or press Enter to close. Escape cancels.` : issues[0] || (state.model.geometryEnabled ? `${state.model.spatial.blockingRegions.length} blocking regions. ${state.grid.snap ? 'Grid snapping on; Alt bypasses it.' : 'Grid snapping off.'}` : 'Saved legacy geometry is preserved until you explicitly edit it.'));
  status.dataset.error = String(Boolean(state.error || state.conflict || issues.length));
  if (inspector) { const node = root.querySelector('.asset-editor-inspector'); const top = node.scrollTop; node.replaceChildren(inspectorContent(state)); node.scrollTop = top; if (state.view === 'properties') root.querySelector('[data-asset-editor-view="properties"]').replaceChildren(propertiesContent(state)); }
  root.querySelector('[data-asset-editor-grid-popup]').hidden = !state.gridOpen;
  for (const control of root.querySelectorAll('button,input,select')) control.disabled = locked;
  for (const control of root.querySelectorAll('[data-asset-editor-tool]')) { const tool = control.dataset.assetEditorTool; control.setAttribute('aria-pressed', String(state.tool === tool)); if (!state.model.geometryEnabled && !['select', 'grid', 'undo', 'redo'].includes(tool)) control.disabled = true; if (tool === 'undo') control.disabled ||= !state.history.past.length; if (tool === 'redo') control.disabled ||= !state.history.future.length; if (tool === 'insert') control.disabled ||= selectedAssetRegion(state)?.shape.kind !== 'polygon'; if (tool === 'remove') control.disabled ||= !selectedAssetRegion(state); }
  for (const control of root.querySelectorAll('[data-asset-editor-action="save"]')) control.disabled ||= Boolean(state.conflict || issues.length || state.gesture);
  for (const control of root.querySelectorAll('[data-asset-editor-action="view"]')) { control.setAttribute('aria-pressed', String(control.dataset.value === state.view)); if (control.dataset.value === 'preview') control.disabled ||= Boolean(state.gesture || state.polygonDraft.length || (state.model.geometryEnabled && issues.some(i => !i.startsWith('Give the Asset')))); }
  root.querySelector('[data-asset-editor-action="finish-polygon"]').hidden = !state.polygonDraft.length;
  root.querySelector('[data-asset-editor-saved-state]').textContent = isEmbeddedGeometry(state) ? 'Custom blocking draft · Return keeps it; Assembly Save validates it' : assetEditorDirty(state) ? 'Unsaved changes · Save creates a draft Asset version' : state.context.assetVersion ? `Saved Asset v${state.context.assetVersion} · metadata v${state.context.metadataVersion}` : 'New Asset · not saved yet';
  const recovery = root.querySelector('[data-asset-editor-recovery]'); recovery.replaceChildren();
  if (state.save.status === 'uncertain') { recovery.append(button('Check saved outcome', 'check-outcome'), button('Retry exact save', 'retry')); }
  else if (state.conflict) recovery.append(button('Recheck saved version', 'recheck'));
  if (state.view === 'preview' && (inspector || !root.querySelector('[data-asset-editor-view="preview"]').childElementCount)) { const preview = root.querySelector('[data-asset-editor-view="preview"]'); const picture = svg('svg', { viewBox: `${state.frame?.x ?? 0} ${state.frame?.y ?? 0} ${state.frame?.width ?? state.initial.pixelSize.width} ${state.frame?.height ?? state.initial.pixelSize.height}`, role: 'img', 'aria-label': 'Read-only authored blocking geometry' }); picture.append(isEmbeddedGeometry(state) ? createAssemblyArtwork(state.initial.artworkScene, { projectId: state.context.projectId }) : svg('image', { href: state.initial.previewUrl, width: state.initial.pixelSize.width, height: state.initial.pixelSize.height })); for (const r of state.model.spatial.blockingRegions) picture.append(shapeNode(r.shape, { class: 'asset-editor-region', ...(isEmbeddedGeometry(state) ? { transform: `matrix(${embeddedRegion(state, r).transform.join(' ')})` } : {}) })); const note = el('aside'); note.append(el('h3', '', 'Geometry inspection · read-only'), el('p', '', 'This shows your exact current draft. It does not simulate character size, pathfinding or game movement. Nothing is saved, accepted or published.')); for (const r of state.model.spatial.blockingRegions) note.append(el('p', '', `${r.name} · ${r.shape.kind}`)); note.append(button('Return to editing', 'view', 'edit')); preview.replaceChildren(picture, note); }
  // Rebuilding an inspector must preserve the user's raw, incomplete number.
  for (const field of root.querySelectorAll('[data-asset-editor-field]')) {
    const path = field.dataset.assetEditorField;
    if (field !== document.activeElement && Object.hasOwn(state.fieldDrafts, path)) field.value = state.fieldDrafts[path];
  }
  syncAssetEditorCanvas(root, state);
}
