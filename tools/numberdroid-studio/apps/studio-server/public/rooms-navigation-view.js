// Read-only Room collection projection. Commands and navigation state belong to app.js.
const SVG_NS = 'http://www.w3.org/2000/svg';
const list = value => Array.isArray(value) ? value : [];
const kindName = kind => kind === 'hallway' ? 'Hallway' : kind === 'room' ? 'Room' : 'Kind unavailable';
const lifecycleName = value => ({ DRAFT: 'Draft · editable', VALIDATED: 'Validated · read-only', FINAL: 'Final · read-only' })[value] ?? 'Status unavailable';
const exactHead = entry => list(entry?.versions).find(version => version.version === entry.headVersion) ?? null;
const exactTemplate = (library, room) => list(library?.archetypes).find(template => template.roomArchetypeId === room?.roomArchetypeId && template.version === room?.archetypeVersion) ?? null;
const currentTemplates = library => {
  const current = new Map();
  for (const template of list(library?.archetypes)) {
    if (!current.has(template.roomArchetypeId) || template.version > current.get(template.roomArchetypeId).version) current.set(template.roomArchetypeId, template);
  }
  return [...current.values()];
};

function element(document, tag, className = '', text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function action(document, text, name, id, onAction, primary = false, version) {
  const button = element(document, 'button', primary ? '' : 'secondary', text);
  button.type = 'button'; button.dataset.roomNavAction = name;
  if (id !== undefined) button.dataset.roomNavId = id;
  if (version !== undefined) button.dataset.roomTemplateVersion = String(version);
  button.addEventListener('click', () => onAction?.(name, id, version));
  return button;
}

function svgElement(document, tag, attributes) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function roomSchematic(document, room) {
  const frame = element(document, 'div', 'rooms-nav-thumbnail');
  const validSize = Number.isInteger(room?.width) && Number.isInteger(room?.height)
    && room.width > 0 && room.height > 0 && room.width <= 64 && room.height <= 64;
  if (!validSize) { frame.append(element(document, 'p', '', 'Saved room outline unavailable')); return frame; }
  const svg = svgElement(document, 'svg', { viewBox: `-0.4 -0.4 ${room.width + 0.8} ${room.height + 0.8}`, role: 'img', 'aria-label': `${room.displayName}: saved room shape and entrances. Schematic only; artwork is not shown.` });
  const outside = new Set(list(room.voidCells).map(cell => `${cell.x},${cell.y}`));
  const blocked = new Set(list(room.blockedCells).map(cell => `${cell.x},${cell.y}`));
  for (let y = 0; y < room.height; y += 1) for (let x = 0; x < room.width; x += 1) {
    if (outside.has(`${x},${y}`)) continue;
    svg.append(svgElement(document, 'rect', { x, y, width: 1, height: 1, fill: blocked.has(`${x},${y}`) ? '#805e43' : '#345b4c', stroke: '#8aa99c', 'stroke-width': 0.025 }));
    if (blocked.has(`${x},${y}`)) svg.append(svgElement(document, 'path', { d: `M${x + 0.12} ${y + 0.12}l0.76 0.76m0 -0.76l-0.76 0.76`, stroke: '#e2c9a5', 'stroke-width': 0.055 }));
  }
  for (const connector of list(room.connectors)) {
    const offset = connector.offset; const width = connector.width;
    if (!Number.isFinite(offset) || !Number.isFinite(width)) continue;
    const paths = { north: `M${offset} 0h${width}`, south: `M${offset} ${room.height}h${width}`, west: `M0 ${offset}v${width}`, east: `M${room.width} ${offset}v${width}` };
    if (paths[connector.side]) svg.append(svgElement(document, 'path', { d: paths[connector.side], stroke: '#ffcc70', 'stroke-width': 0.11 }));
  }
  frame.append(svg, element(document, 'small', 'rooms-nav-schematic-caption', 'Shape & entrances · schematic'));
  return frame;
}

function templateSchematic(document, template) {
  const frame = element(document, 'div', 'rooms-nav-thumbnail rooms-nav-template-thumbnail');
  const dimensions = template.dimensionPolicy;
  frame.append(element(document, 'strong', '', `${dimensions?.width?.preferred ?? '?'} × ${dimensions?.height?.preferred ?? '?'}`), element(document, 'span', '', 'Suggested cells · no placed assets'));
  return frame;
}

function roomCard(document, library, entry, onAction) {
  const room = exactHead(entry); const template = exactTemplate(library, room);
  const card = element(document, 'article', 'rooms-nav-card'); card.dataset.roomCard = entry.roomVariantId;
  card.append(roomSchematic(document, room));
  const body = element(document, 'div', 'rooms-nav-card-body');
  body.append(element(document, 'h3', '', room?.displayName ?? entry.roomVariantId));
  if (room) {
    body.append(element(document, 'p', '', `${room.width} × ${room.height} cells · ${kindName(template?.kind)}`));
    const badge = element(document, 'span', 'rooms-nav-status', lifecycleName(room.lifecycle)); badge.dataset.roomLifecycle = room.lifecycle; body.append(badge);
    body.append(element(document, 'p', '', `Template: ${template?.displayName ?? 'Exact saved template unavailable'}`));
    body.append(element(document, 'p', '', `${list(room.placements).length} placed asset${list(room.placements).length === 1 ? '' : 's'} · Saved version ${room.version}`));
    const findings = Array.isArray(room.findings) ? room.findings : null;
    const errors = findings?.filter(finding => finding.severity === 'ERROR').length;
    const warnings = findings?.filter(finding => finding.severity === 'WARNING').length;
    const attention = element(document, 'p', 'rooms-nav-attention', findings
      ? `${errors} saved error${errors === 1 ? '' : 's'} · ${warnings} warning${warnings === 1 ? '' : 's'}`
      : 'Saved findings unavailable — needs attention');
    attention.dataset.tone = findings && !errors ? 'neutral' : 'problem'; body.append(attention);
  } else body.append(element(document, 'p', 'rooms-nav-attention', 'The exact saved version is unavailable. No other version is shown as current.'));
  const actions = element(document, 'div', 'rooms-nav-card-actions');
  actions.append(action(document, room?.lifecycle === 'DRAFT' ? 'Open room' : room ? 'View room' : 'Inspect unavailable room', 'open-room', entry.roomVariantId, onAction));
  body.append(actions); card.append(body); return card;
}

function templateCard(document, library, template, onAction) {
  const card = element(document, 'article', 'rooms-nav-card'); card.dataset.roomTemplateCard = template.roomArchetypeId;
  card.dataset.roomTemplateVersion = String(template.version);
  card.append(templateSchematic(document, template));
  const body = element(document, 'div', 'rooms-nav-card-body');
  const uses = list(library.variants).filter(entry => { const room = exactHead(entry); return room?.roomArchetypeId === template.roomArchetypeId && room.archetypeVersion === template.version; }).length;
  body.append(element(document, 'h3', '', template.displayName), element(document, 'p', '', `${kindName(template.kind)} · Template version ${template.version}`), element(document, 'p', '', 'Reusable size and placement rules. No floor or furniture included.'), element(document, 'p', '', `${uses} room${uses === 1 ? '' : 's'} use this exact template version`));
  const actions = element(document, 'div', 'rooms-nav-card-actions');
  for (const [text, name, primary] of [['Create room from this template', 'from-template', true], ['View rules', 'view-template', false]]) {
    actions.append(action(document, text, name, template.roomArchetypeId, onAction, primary, template.version));
  }
  body.append(actions); card.append(body); return card;
}

/** Builds a read-only collection. Callbacks own all filter/navigation state. */
export function renderRoomsCollection({ document, library, ui, onAction, onFilter }) {
  const tab = ui.tab === 'templates' ? 'templates' : 'rooms';
  const rooms = list(library?.variants); const templates = currentTemplates(library);
  const root = element(document, 'section', 'rooms-navigation'); root.dataset.roomsCollection = tab;
  const header = element(document, 'div', 'rooms-nav-heading'); const title = element(document, 'div');
  const heading = element(document, 'h2', '', 'Rooms'); heading.tabIndex = -1;
  title.append(heading, element(document, 'p', '', 'Your room designs and the reusable rules they start from.'));
  const newButton = action(document, tab === 'rooms' ? 'New room' : 'New template', tab === 'rooms' ? 'new-room' : 'new-template', undefined, onAction, true);
  if (tab === 'rooms' && !templates.length) { newButton.disabled = true; newButton.title = 'Create a template first. It supplies the starting size and rules for a room.'; }
  header.append(title, newButton); root.append(header);
  const tabs = element(document, 'div', 'rooms-nav-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Room content');
  for (const [key, label, count] of [['rooms', 'Rooms', rooms.length], ['templates', 'Templates', templates.length]]) {
    const button = action(document, `${label} (${count})`, 'tab', key, onAction);
    button.id = `room-nav-tab-${key}`; button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', String(tab === key)); button.setAttribute('aria-controls', 'rooms-nav-panel'); button.tabIndex = tab === key ? 0 : -1;
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const next = event.key === 'Home' ? 'rooms' : event.key === 'End' ? 'templates' : key === 'rooms' ? 'templates' : 'rooms';
      onAction?.('tab', next);
      document.getElementById(`room-nav-tab-${next}`)?.focus({ preventScroll: true });
    }); tabs.append(button);
  }
  root.append(tabs);
  const panel = element(document, 'section'); panel.id = 'rooms-nav-panel'; panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', `room-nav-tab-${tab}`);
  const filters = element(document, 'div', 'rooms-nav-filters');
  const searchLabel = element(document, 'label', '', 'Search'); const search = element(document, 'input'); search.type = 'search'; search.value = ui.search?.[tab] ?? ''; search.placeholder = tab === 'rooms' ? 'Room names and templates' : 'Template names'; search.dataset.roomNavFilter = 'search'; search.dataset.assetFocusKey = `rooms:${tab}:search`;
  search.addEventListener('input', () => onFilter?.('search', search.value)); searchLabel.append(search);
  const field = tab === 'rooms' ? 'status' : 'kind';
  const filterLabel = element(document, 'label', '', tab === 'rooms' ? 'Status' : 'Kind'); const select = element(document, 'select'); select.dataset.roomNavFilter = field; select.dataset.assetFocusKey = `rooms:${tab}:${field}`;
  const choices = tab === 'rooms' ? [['all', 'All statuses'], ['DRAFT', 'Draft'], ['VALIDATED', 'Validated'], ['FINAL', 'Final']] : [['all', 'All kinds'], ['room', 'Room'], ['hallway', 'Hallway']];
  for (const [value, text] of choices) { const option = element(document, 'option', '', text); option.value = value; select.append(option); }
  select.value = ui[field] ?? 'all'; select.addEventListener('change', () => onFilter?.(field, select.value)); filterLabel.append(select); filters.append(searchLabel, filterLabel); panel.append(filters);
  const needle = String(ui.search?.[tab] ?? '').trim().toLocaleLowerCase();
  const entries = tab === 'rooms' ? rooms.filter(entry => {
    const room = exactHead(entry); const template = exactTemplate(library, room);
    return ((ui.status ?? 'all') === 'all' || room?.lifecycle === ui.status) && `${room?.displayName ?? entry.roomVariantId} ${template?.displayName ?? ''}`.toLocaleLowerCase().includes(needle);
  }) : templates.filter(template => ((ui.kind ?? 'all') === 'all' || template.kind === ui.kind) && String(template.displayName).toLocaleLowerCase().includes(needle));
  const count = element(document, 'p', 'rooms-nav-result-count', `${entries.length} of ${tab === 'rooms' ? rooms.length : templates.length} ${tab}${tab === 'templates' ? ' · Starting rules, not furnished room copies.' : ''}`); count.setAttribute('aria-live', 'polite'); panel.append(count);
  const created = ui.lastCreated;
  const identityKey = tab === 'rooms' ? 'roomVariantId' : 'roomArchetypeId';
  const savedCreated = created?.tab === tab
    ? (tab === 'rooms' ? rooms : templates).find(entry => entry[identityKey] === created.id)
    : null;
  const savedName = tab === 'rooms' ? exactHead(savedCreated)?.displayName : savedCreated?.displayName;
  if (savedName && !entries.some(entry => entry[identityKey] === created.id)) {
    const notice = element(document, 'div', 'rooms-nav-hidden-created');
    notice.setAttribute('role', 'status');
    notice.append(element(document, 'p', '', `${savedName} was saved, but your current filters hide it.`), action(document, 'Show all', 'clear-filters', undefined, onAction));
    panel.append(notice);
  }
  const cards = element(document, 'div', 'rooms-nav-cards');
  for (const entry of entries) cards.append(tab === 'rooms' ? roomCard(document, library, entry, onAction) : templateCard(document, library, entry, onAction));
  if (!entries.length) {
    const empty = element(document, 'div', 'rooms-nav-empty');
    const total = tab === 'rooms' ? rooms.length : templates.length;
    if (total) empty.append(element(document, 'h3', '', 'No matches'), element(document, 'p', '', 'Try another name or clear your filters.'), action(document, 'Clear filters', 'clear-filters', undefined, onAction));
    else if (!templates.length) empty.append(element(document, 'h3', '', tab === 'rooms' ? 'Start with a room template' : 'No templates yet'), element(document, 'p', '', 'A template saves reusable size and placement rules. Create one first, then create a separate editable room from it.'), action(document, 'New template', 'new-template', undefined, onAction, true));
    else empty.append(element(document, 'h3', '', 'No rooms yet'), element(document, 'p', '', 'Choose a template to create your first editable draft. Its floor and furniture start empty.'), action(document, 'New room', 'new-room', undefined, onAction, true));
    cards.append(empty);
  }
  panel.append(cards); root.append(panel); return root;
}

/** Inspects the exact supplied immutable template; no editor or commands. */
export function renderRoomTemplateDetail({ document, template, onAction }) {
  const root = element(document, 'section', 'rooms-navigation rooms-template-detail');
  if (!template) { root.append(element(document, 'h2', '', 'Template unavailable'), element(document, 'p', '', 'The selected exact template is unavailable. No other version has been opened.')); return root; }
  const header = element(document, 'div', 'rooms-nav-heading'); const title = element(document, 'div');
  const heading = element(document, 'h2', '', template.displayName); heading.tabIndex = -1;
  title.append(heading, element(document, 'p', '', `Room template · Reusable starting rules · Version ${template.version}`));
  const create = action(document, 'Create room from this template', 'from-template', template.roomArchetypeId, onAction, true, template.version); header.append(title, create); root.append(header);
  const facts = element(document, 'dl', 'rooms-nav-template-facts');
  const range = value => value ? `${value.preferred} suggested · ${value.min}–${value.max} allowed` : 'Unavailable';
  const connector = template.connectorPolicy;
  const rows = [
    ['Kind', kindName(template.kind)], ['Width (cells)', range(template.dimensionPolicy?.width)], ['Height (cells)', range(template.dimensionPolicy?.height)],
    ['Allowed content', list(template.allowedAssetKinds).join(', ') || 'None'],
    ['Entrance rules', connector ? `${connector.min}–${connector.max} entrances; required sides: ${list(connector.requiredSides).join(', ') || 'none'}` : 'Unavailable'],
    ['Orientation', template.orientation ?? 'Unavailable'],
    ['Reserved edge bands (cells)', template.structuralBands ? ['left', 'right', 'top', 'bottom'].map(side => `${side}: ${template.structuralBands[side]}`).join(' · ') : 'Unavailable'],
    ['Allowed tags', list(template.allowedTags).join(', ') || 'No tag restriction'], ['Required tags', list(template.requiredTags).join(', ') || 'None'], ['Rationality', template.rationality ?? 'Unavailable'],
  ];
  for (const [label, value] of rows) { const row = element(document, 'div'); row.append(element(document, 'dt', '', label), element(document, 'dd', '', value)); facts.append(row); }
  root.append(facts);
  if (list(template.governingRuleRefs).length) {
    const rules = element(document, 'ul', 'rooms-nav-rule-list');
    for (const rule of template.governingRuleRefs) rules.append(element(document, 'li', '', rule.summary || rule.ruleId));
    root.append(element(document, 'h3', '', 'Design rules'), rules);
  }
  root.append(element(document, 'p', 'rooms-nav-template-note', 'This template contains no placed assets. Rooms retain the exact template version they were created with. Editing a room does not change its template or any other room.'));
  return root;
}
