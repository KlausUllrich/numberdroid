import { filterLibraryItems } from './library-state.js';
import {
  libraryElement as el, libraryAction, libraryContentLabel, libraryContentSummary,
  setLibraryAssetIdentity, setLibraryReviewIdentity, createLibraryPreviewLink,
} from './library-detail-view.js';

const plural = (count, singular, multiple = `${singular}s`) => `${count} ${count === 1 ? singular : multiple}`;
const stateLabel = group => ({
  PENDING: 'Awaiting review', DECIDED: 'Decision recorded · awaiting apply',
  CHANGES_REQUESTED: 'Changes requested · awaiting revision', ACCEPTED: 'Accepted',
  DISCARDED: 'Discarded', APPLIED: 'Applied',
})[group.status] ?? group.status ?? 'Unavailable decision state';

function empty(title, message) {
  const panel = el('div', 'library-empty');
  panel.append(el('h3', '', title), el('p', '', message));
  return panel;
}

function filterControl(tab, field, label, choices, current) {
  const wrapper = el('label', `library-filter library-filter-${field}`);
  wrapper.append(el('span', '', label));
  const control = el('select');
  control.dataset.libraryFilter = field;
  control.dataset.libraryTab = tab;
  control.dataset.assetFocusKey = `library:${tab}:filter:${field}`;
  for (const [value, text] of choices) {
    const option = el('option', '', text); option.value = value; control.append(option);
  }
  control.value = current;
  wrapper.append(control);
  return wrapper;
}

function filters(tab, selected) {
  const toolbar = el('div', 'library-filters');
  toolbar.dataset.libraryFilters = tab;
  const search = el('label', 'library-filter library-filter-search');
  search.append(el('span', '', 'Search'));
  const input = el('input'); input.type = 'search'; input.placeholder = tab === 'assets' ? 'Names, sources and tags' : 'Changes, tasks and agents';
  input.value = selected.search; input.dataset.libraryFilter = 'search'; input.dataset.libraryTab = tab;
  input.dataset.assetFocusKey = `library:${tab}:filter:search`;
  search.append(input);
  toolbar.append(search,
    filterControl(tab, 'content', 'Content', [['all', 'All content'], ['image', 'Image'], ['animation', 'Animation'], ['assembly', 'Assembly']], selected.content),
    filterControl(tab, 'use', 'Use', [['all', 'All uses'], ['surface', 'Surface'], ['prop', 'Prop'], ['item', 'Item']], selected.use));
  return toolbar;
}

export function renderLibraryCard({ entry, projectId, record = entry.asset, scene = record?.scene,
  previewUrl = null, pendingGroups = entry.relatedReviews ?? [] }) {
  const asset = entry.asset;
  const article = el('article', 'card asset-card asset-v2-card library-card');
  article.dataset.libraryCard = entry.key;
  article.dataset.libraryStatus = 'saved';
  setLibraryAssetIdentity(article, entry);
  if (entry.contentKind === 'assembly') article.dataset.assemblyAssetId = asset.assetId;
  if (entry.contentKind === 'animation') article.dataset.animationAssetId = asset.assetId;
  article.append(createLibraryPreviewLink({ entry, record, scene, projectId, previewUrl }));
  if (entry.contentKind !== 'image') article.append(el('p', 'library-card-presentation', `${libraryContentLabel(entry.contentKind)} · saved presentation · paused`));
  const title = el('h3', 'library-card-title');
  title.append(libraryAction('details', asset.name, { entry, className: 'library-name-button' }));
  article.append(title, el('p', 'library-card-summary', libraryContentSummary(asset, entry.contentKind)));
  const badges = el('div', 'library-card-badges');
  badges.append(el('span', 'library-content-badge', `${libraryContentLabel(entry.contentKind)} · ${asset.kind}`),
    el('span', 'status-pill library-saved-badge', `Saved · ${asset.lifecycle ?? 'DRAFT'}`));
  article.append(badges);
  if (pendingGroups.length) {
    const pending = el('div', 'library-card-pending');
    for (const group of pendingGroups) pending.append(libraryAction('review', `Pending changes · ${plural(group.changeCount, 'change')}`, { group, className: 'library-pending-badge' }));
    article.append(pending);
  }
  const actions = el('div', 'library-card-actions');
  actions.append(libraryAction('details', 'Details', { entry }));
  article.append(actions);
  return article;
}

function reviewRow(group, completed = false) {
  const row = el('article', 'library-review-row');
  row.dataset.libraryGroup = group.key;
  row.dataset.libraryGroupState = group.status;
  setLibraryReviewIdentity(row, group);
  const copy = el('div', 'library-review-copy');
  copy.append(el('p', 'library-eyebrow', `${libraryContentLabel(group.contentKind)} · ${plural(group.changeCount, 'change')}`),
    el('h3', '', group.title), el('p', 'library-review-state', stateLabel(group)));
  const context = [group.actorName ?? group.actorId, group.taskId ? `Task ${group.taskId}` : null].filter(Boolean);
  if (context.length) copy.append(el('p', 'library-review-context', context.join(' · ')));
  row.append(copy, libraryAction('review', completed ? 'Inspect review' : 'Review changes', { group }));
  return row;
}

export function renderLibraryPending({ groups }) {
  const section = el('section', 'library-pending-list');
  section.dataset.libraryPendingList = '';
  for (const group of groups) section.append(reviewRow(group));
  return section;
}

export function renderLibraryHistory({ groups }) {
  const section = el('section', 'library-history');
  section.dataset.libraryHistory = '';
  const completed = groups.filter(group => !group.pending);
  section.append(el('h2', '', 'Completed Library reviews'));
  if (!completed.length) section.append(el('p', 'library-muted', 'Completed Library reviews appear here with their saved decisions.'));
  else for (const group of completed) section.append(reviewRow(group, true));
  return section;
}

export function renderLibraryNavigation({ ui, items, groups, renderCard, canCreateAssembly = true, canAddFromSources = true }) {
  const page = el('section', 'library-workspace');
  page.dataset.libraryWorkspace = '';
  const tab = ui.tab ?? 'assets', pending = groups.filter(group => group.pending);
  const header = el('header', 'library-header'), title = el('div');
  title.append(el('h2', '', 'Library'), el('p', 'library-muted', 'Saved reusable content and changes awaiting review.'));
  const actions = el('div', 'library-entry-actions');
  const sources = libraryAction('add-from-sources', 'Add from Sources'); sources.disabled = !canAddFromSources;
  const assembly = libraryAction('create-assembly', 'Create Assembly', { className: 'primary' }); assembly.disabled = !canCreateAssembly;
  actions.append(sources, assembly); header.append(title, actions); page.append(header);
  const tabs = el('nav', 'library-tabs'); tabs.setAttribute('aria-label', 'Library sections');
  for (const [key, label] of [['assets', 'Assets'], ['pending', `Pending changes (${pending.length})`]]) {
    const button = libraryAction('tab', label, { className: `library-tab${tab === key ? ' selected' : ''}` });
    button.dataset.libraryTab = key; button.dataset.assetFocusKey = `library:tab:${key}`;
    button.setAttribute('aria-current', tab === key ? 'page' : 'false'); tabs.append(button);
  }
  page.append(tabs);
  const selected = ui.filters[tab], candidates = tab === 'assets' ? items : pending;
  page.append(filters(tab, selected));
  const visible = filterLibraryItems(candidates, selected);
  const count = el('p', 'library-result-count', tab === 'assets'
    ? `${visible.length} of ${plural(items.length, 'asset')}` : `${visible.length} of ${plural(pending.length, 'review group')}`);
  count.setAttribute('aria-live', 'polite'); count.dataset.libraryResultCount = ''; page.append(count);
  if (!visible.length) {
    const narrowed = selected.search.trim() || selected.content !== 'all' || selected.use !== 'all';
    const panel = empty(narrowed ? 'No matching results' : tab === 'assets' ? 'Your Library is empty' : 'No pending changes',
      narrowed ? 'Clear the filters to see the other content in this section.' : tab === 'assets'
        ? 'Add an image or Animation from Sources, or create an Assembly from saved components.'
        : 'New proposals appear here. Completed reviews remain available in Activity.');
    if (narrowed) { const clear = libraryAction('clear-filters', 'Clear filters'); clear.dataset.libraryTab = tab; panel.append(clear); }
    page.append(panel);
  } else if (tab === 'assets') {
    const grid = el('div', 'card-grid asset-grid asset-inventory-grid library-card-grid');
    grid.dataset.assetScroll = 'library-assets'; grid.dataset.libraryAssetGrid = '';
    for (const entry of visible) grid.append(renderCard(entry));
    page.append(grid);
  } else page.append(renderLibraryPending({ groups: visible }));
  return page;
}
