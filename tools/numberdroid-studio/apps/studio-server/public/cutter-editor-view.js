import { cutterDisplayName, cutterEditIssues, cutterGridInfo, cutterGridStops } from './cutter-editor-state.js';
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const svg = (tag, attrs = {}) => { const n = document.createElementNS(NS, tag); for (const [key, value] of Object.entries(attrs)) n.setAttribute(key, String(value)); return n; };
const action = (label, data, disabled = false) => { const n = el('button', 'secondary', label); n.type = 'button'; Object.assign(n.dataset, data); n.disabled = disabled; return n; };
const field = (label, input) => { const n = el('label', 'cutter-field'); n.append(el('span', '', label), input); return n; };
const input = (type, value, data) => { const n = el('input'); n.type = type; if (type === 'checkbox') n.checked = value; else n.value = value; Object.assign(n.dataset, data); return n; };
export function cutterOutputName(output, index) { return cutterDisplayName(output.rectangle ?? output, index); }

export function cutterOutputCard(output, index, projectId) {
  const card = el('figure', 'slice-preview');
  const uri = output.preview?.resourceUri ?? `/api/projects/${encodeURIComponent(projectId)}/artifacts/sha256/${output.digest}`;
  const link = el('a', 'cutter-output-image'); link.href = uri; link.target = '_blank'; link.rel = 'noopener'; link.title = 'Open full image in a new tab';
  const image = el('img'); image.src = uri; image.alt = cutterOutputName(output, index); image.loading = 'eager'; link.append(image);
  const caption = el('figcaption'); caption.append(el('strong', '', cutterOutputName(output, index)), el('span', '', `${output.width} × ${output.height} px`));
  card.append(link, caption, action('Details', { cutterOutput: String(index), cutterOutputKind: output.sliceId ? 'saved' : 'preview' }));
  return card;
}

export function renderCutterEditor({ cutter, source, atlas, pending, job }) {
  const section = el('section', 'atlas-cutter'); section.dataset.atlasCutter = ''; section.dataset.cutterInstance = cutter.instanceId;
  const header = el('div', 'cutter-heading');
  const title = el('div'); title.append(el('p', 'eyebrow', 'Sources / Preparation'), el('h2', '', cutter.name), el('p', '', 'Choose the image regions to keep. Save work stores your cuts; Preview cuts prepares their exact PNG images.'));
  header.append(title, action('Back to Sources', { closeCutter: '' }, pending)); section.append(header);
  const tabs = el('nav', 'cutter-view-tabs'); tabs.setAttribute('aria-label', 'Cutter views');
  for (const [view, label] of [['edit', 'Cut image'], ['outputs', 'Output images']]) { const b = action(label, { cutterView: view }, pending); b.setAttribute('aria-pressed', String(cutter.view === view || (view === 'outputs' && cutter.view === 'detail'))); tabs.append(b); }
  section.append(tabs);
  if (cutter.view !== 'edit') return section;
  const layout = el('div', 'cutter-editor-layout');
  const rail = el('div', 'cutter-tool-rail'); rail.setAttribute('aria-label', 'Cutting tools');
  for (const [tool, label] of [['select', 'Select'], ['draw', 'Draw cut'], ['grid', 'Grid'], ['remove', 'Remove'], ['undo', 'Undo'], ['redo', 'Redo'], ['save', 'Save work']]) {
    const disabled = pending || (tool === 'remove' && !cutter.rectangles[cutter.selectedIndex]) || (tool === 'undo' && !cutter.history.past.length) || (tool === 'redo' && !cutter.history.future.length);
    const b = action(label, tool === 'save' ? { saveAtlas: '' } : { cutterTool: tool }, disabled);
    if (['select', 'draw'].includes(tool)) b.setAttribute('aria-pressed', String(cutter.tool === tool));
    if (tool === 'grid') { b.setAttribute('aria-expanded', String(cutter.gridOpen)); b.setAttribute('aria-controls', 'cutter-grid-popup'); }
    rail.append(b);
  }
  const main = el('div', 'cutter-main'); main.dataset.cutterMain = cutter.instanceId;
  const zoom = el('div', 'cutter-zoom-bar');
  const fit = action('Fit', { cutterZoomAction: 'fit' }); const actual = action('100%', { cutterZoomAction: '1' }); actual.title = '1 source pixel = 1 canvas CSS pixel';
  const range = input('range', cutter.zoom === 'fit' ? 100 : Number(cutter.zoom) * 100, { cutterZoom: '' }); range.min = '10'; range.max = '400'; range.step = '1'; range.setAttribute('aria-label', 'Cutter zoom percent');
  const label = el('output'); label.dataset.cutterZoomLabel = '';
  zoom.append(fit, range, actual, label); main.append(zoom);
  const status = el('div', 'cutter-validation'); status.dataset.cutterValidation = ''; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); main.append(status);
  const scroll = el('div', 'cutter-scroll'); scroll.dataset.cutterScrollContext = JSON.stringify([cutter.projectId, cutter.sourceId, cutter.atlasId, cutter.instanceId, cutter.zoom]);
  const canvas = el('div', 'cutter-canvas'); canvas.dataset.cutterCanvas = '';
  const image = el('img'); image.src = source.preview.resourceUri; image.alt = `${source.name} source image`; image.draggable = false;
  const overlay = svg('svg', { viewBox: `0 0 ${source.width} ${source.height}`, tabindex: 0, 'aria-label': 'Exact source-pixel cutting canvas' }); overlay.dataset.cutterOverlay = '';
  canvas.append(image, overlay); scroll.append(canvas); main.append(scroll);
  const caption = el('p', 'cutter-caption'); caption.dataset.cutterCaption = ''; main.append(caption);
  const inspector = el('aside', 'rectangle-inspector'); inspector.setAttribute('aria-label', 'Cuts and selected cut');
  inspector.append(el('h3', '', 'Cuts to keep'), el('p', 'cutter-note', 'Select a cut to edit it. Its checkbox controls whether it becomes an output.'));
  const list = el('div', 'cutter-cut-list'); list.dataset.cutterCutList = '';
  cutter.rectangles.forEach((rectangle, index) => {
    const row = el('div', 'cutter-cut-choice'); row.dataset.selected = String(index === cutter.selectedIndex);
    const check = input('checkbox', rectangle.included, { rectangleIndex: String(index), rectangleField: 'included' }); check.disabled = pending; check.setAttribute('aria-label', `Keep ${cutterDisplayName(rectangle, index)}`);
    const b = action('', { cutterSelect: String(index) }, pending); b.setAttribute('aria-pressed', String(index === cutter.selectedIndex)); b.append(el('strong', '', `${index + 1} · ${cutterDisplayName(rectangle, index)}`), el('small', '', `${rectangle.width} × ${rectangle.height} px`)); row.append(check, b); list.append(row);
  });
  if (!cutter.rectangles.length) list.append(el('p', 'cutter-note', 'Draw a cut on the image, or create cuts from a grid.'));
  inspector.append(list);
  const rectangle = cutter.rectangles[cutter.selectedIndex];
  if (rectangle) {
    const properties = el('fieldset', 'rectangle-row'); properties.dataset.rectangleRow = String(cutter.selectedIndex); properties.append(el('legend', '', 'Selected cut'));
    const name = input('text', rectangle.name ?? '', { rectangleIndex: String(cutter.selectedIndex), rectangleField: 'name' }); name.maxLength = 160; name.placeholder = cutterDisplayName({}, cutter.selectedIndex); name.disabled = pending;
    properties.append(field('Name', name));
    const pair = el('div', 'cutter-coordinates');
    for (const [key, label] of [['x', 'Left'], ['y', 'Top'], ['width', 'Width'], ['height', 'Height']]) { const n = input('number', rectangle[key], { rectangleIndex: String(cutter.selectedIndex), rectangleField: key }); n.min = ['width', 'height'].includes(key) ? '1' : '0'; n.max = String(['x', 'width'].includes(key) ? source.width : source.height); n.step = '1'; n.disabled = pending; pair.append(field(label, n)); }
    properties.append(pair, el('p', 'cutter-note', 'Values are exact source pixels. Arrow keys move 1 pixel; Shift moves 10.'));
    const details = el('details', 'cutter-identity'); details.append(el('summary', '', 'Source and recut identity'));
    details.append(el('small', '', rectangle.rectangleId));
    const replacement = el('select'); Object.assign(replacement.dataset, { rectangleIndex: String(cutter.selectedIndex), rectangleField: 'replacesSliceId' });
    const newIdentity = el('option', '', 'New saved cut identity'); newIdentity.value = ''; replacement.append(newIdentity);
    for (const [i, slice] of (atlas?.sliceHeads ?? []).entries()) { const opt = el('option', '', `${cutterOutputName(slice, i)} · version ${slice.version}`); opt.value = slice.sliceId; replacement.append(opt); }
    replacement.value = rectangle.replacesSliceId ?? ''; replacement.disabled = pending || !rectangle.included || !atlas?.sliceHeads?.length;
    details.append(field('When saving outputs', replacement), el('p', 'cutter-note', 'Replacing a saved cut creates a new version. Existing Assets retain the version they already use.')); properties.append(details); inspector.append(properties);
  }
  inspector.append(action('Add a small cut', { addRectangle: '' }, pending || cutter.rectangles.length >= 64));
  layout.append(rail, main, inspector); section.append(layout);
  const popup = el('section', 'cutter-grid-popup'); popup.id = 'cutter-grid-popup'; popup.dataset.cutterGridPopup = ''; popup.hidden = !cutter.gridOpen; popup.setAttribute('aria-label', 'Grid guides and snapping');
  const ph = el('div', 'cutter-popup-heading'); ph.append(el('h3', '', 'Grid guides'), action('Close', { cutterGridClose: '' })); popup.append(ph);
  const form = el('form', 'cutter-grid-form'); form.dataset.cutterGridForm = '';
  const fields = el('div', 'cutter-grid-fields');
  for (const [key, label] of [['width', 'Cell width'], ['height', 'Cell height'], ['x', 'Left origin'], ['y', 'Top origin'], ['gapX', 'Horizontal gap'], ['gapY', 'Vertical gap']]) { const n = input('number', cutter.guide[key], { cutterGuideField: key }); n.name = key; n.min = ['width', 'height'].includes(key) ? '1' : '0'; n.max = '4096'; n.step = '1'; n.disabled = pending; fields.append(field(label, n)); }
  const show = input('checkbox', cutter.showGrid, { cutterGridToggle: '' }); show.disabled = pending;
  const snap = input('checkbox', cutter.snap, { cutterSnap: '' }); snap.disabled = pending;
  const create = el('button', '', 'Create cuts from grid'); create.type = 'submit'; create.disabled = pending; create.dataset.cutterGridCreate = '';
  const info = el('p', 'cutter-grid-summary'); info.dataset.cutterGridSummary = '';
  form.append(fields, field('Show grid', show), field('Snap to grid · hold Alt to bypass', snap), info, create); popup.append(form); section.append(popup);
  return section;
}

export function syncCutterCanvas(section, { cutter, source, atlas, pending, job }) {
  const main = section.querySelector('[data-cutter-main]'); if (!main) return;
  const scroll = main.querySelector('.cutter-scroll'); const canvas = main.querySelector('.cutter-canvas'); const overlay = canvas.querySelector('svg');
  const fit = Math.min(1, Math.max(1, scroll.clientWidth - 24) / source.width, Math.max(1, scroll.clientHeight - 24) / source.height);
  const scale = cutter.frozenScale ?? (cutter.zoom === 'fit' ? fit : Number(cutter.zoom));
  canvas.style.width = `${source.width * scale}px`; canvas.style.height = `${source.height * scale}px`; canvas.dataset.zoom = cutter.zoom; canvas.dataset.scale = String(scale); overlay.dataset.cutterTool = cutter.tool;
  const range = main.querySelector('[data-cutter-zoom]'); if (document.activeElement !== range) range.value = String(Math.round(scale * 100));
  main.querySelector('[data-cutter-zoom-label]').textContent = `${cutter.zoom === 'fit' ? 'Fit · ' : ''}${Math.round(scale * 100)}%`;
  const issues = cutterEditIssues(cutter.rectangles, source); const unavailable = job && !['APPLIED', 'DISCARDED'].includes(job.state);
  const message = cutter.error || issues.messages.join(' ') || `${cutter.rectangles.filter(r => r.included).length} of ${cutter.rectangles.length} cuts included. ${cutter.snap ? 'Grid snapping on; hold Alt to bypass.' : 'Grid snapping off.'}`;
  main.querySelector('[data-cutter-validation]').textContent = message; main.querySelector('[data-cutter-validation]').dataset.invalid = String(Boolean(cutter.error || issues.messages.length));
  main.querySelector('[data-cutter-caption]').textContent = `${source.width} × ${source.height} source pixels · ${cutter.tool === 'draw' ? 'Drag to draw a cut.' : 'Drag a cut or one of its eight edge and corner handles.'}`;
  let grid = overlay.querySelector('[data-cutter-guides]'); if (!grid) { grid = svg('path', { fill: 'none', 'vector-effect': 'non-scaling-stroke' }); grid.dataset.cutterGuides = ''; overlay.prepend(grid); }
  grid.setAttribute('d', cutter.showGrid ? [...cutterGridStops(source, cutter.guide, 'x').map(x => `M${x} 0V${source.height}`), ...cutterGridStops(source, cutter.guide, 'y').map(y => `M0 ${y}H${source.width}`)].join(' ') : '');
  const kept = new Set();
  cutter.rectangles.forEach((r, index) => {
    let group = [...overlay.querySelectorAll('g[data-rectangle-id]')].find(n => n.dataset.rectangleId === r.rectangleId);
    if (!group) { group = svg('g'); group.dataset.rectangleId = r.rectangleId; group.append(svg('rect'), svg('text')); for (const edge of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) { const h = svg('rect'); h.classList.add('resize-handle'); h.dataset.cutterEdge = edge; group.append(h); } overlay.append(group); }
    kept.add(group); group.classList.toggle('excluded', !r.included); group.classList.toggle('selected', index === cutter.selectedIndex); group.classList.toggle('invalid', issues.invalidRectangleIds.has(r.rectangleId));
    const [shape, label] = group.children; Object.assign(shape.dataset, { cutterMove: String(index) });
    for (const key of ['x', 'y', 'width', 'height']) shape.setAttribute(key, String(Number.isFinite(r[key]) ? r[key] : 0));
    shape.setAttribute('tabindex', pending ? '-1' : '0'); shape.setAttribute('role', 'button'); shape.setAttribute('aria-disabled', String(pending)); shape.setAttribute('aria-label', `${cutterDisplayName(r, index)}: left ${r.x}, top ${r.y}, width ${r.width}, height ${r.height}${r.included ? '' : ', excluded'}`);
    label.setAttribute('x', String(r.x + 7 / scale)); label.setAttribute('y', String(r.y + 18 / scale)); label.style.fontSize = `${12 / scale}px`; label.textContent = String(index + 1);
    for (const h of [...group.children].slice(2)) { const edge = h.dataset.cutterEdge; const size = 10 / scale; const x = edge.includes('w') ? r.x : edge.includes('e') ? r.x + r.width : r.x + r.width / 2; const y = edge.includes('n') ? r.y : edge.includes('s') ? r.y + r.height : r.y + r.height / 2;
      h.setAttribute('x', String(x - size / 2)); h.setAttribute('y', String(y - size / 2)); h.setAttribute('width', String(size)); h.setAttribute('height', String(size)); h.dataset.cutterResize = String(index); h.setAttribute('tabindex', pending || index !== cutter.selectedIndex ? '-1' : '0'); h.setAttribute('role', 'button'); h.setAttribute('aria-label', `Resize ${cutterDisplayName(r, index)} ${edge}`); h.style.display = index === cutter.selectedIndex ? '' : 'none'; }
  });
  for (const group of overlay.querySelectorAll('g[data-rectangle-id]')) if (!kept.has(group)) group.remove();
  for (const control of main.querySelectorAll('button,input')) control.disabled = pending;
  const save = section.querySelector('[data-save-atlas]'); if (save) save.disabled = pending || !issues.canPreview || Boolean(unavailable);
  const info = cutterGridInfo(source, cutter.guide); const summary = section.querySelector('[data-cutter-grid-summary]');
  if (summary) summary.textContent = !info.valid ? 'Enter positive cell sizes and valid origin/gaps.' : `${info.count} full cuts · unused right ${info.unusedRight}px, bottom ${info.unusedBottom}px. This replaces your current layout; Undo restores it.${info.count > 64 ? ' Too many cuts: the limit is 64.' : ''}`;
  const create = section.querySelector('[data-cutter-grid-create]'); if (create) create.disabled = pending || !info.valid || info.count < 1 || info.count > 64;
}
