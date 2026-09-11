const CONTENT_KINDS = new Set(['image', 'animation', 'assembly']);
const USE_KINDS = new Set(['surface', 'prop', 'item']);
const textKey = value => String(value ?? '').toLocaleLowerCase('en-US');
const copy = value => structuredClone(value);
const defaultFilters = () => ({ search: '', content: 'all', use: 'all' });
const positiveVersion = value => Number.isSafeInteger(value) && value > 0;

/** Navigation is transient. Authoring controllers and decision requests stay with the host. */
export function createLibraryUiState(projectId = null) {
  return {
    projectId: typeof projectId === 'object' ? projectId?.projectId ?? null : projectId,
    tab: 'assets',
    route: { view: 'list', tab: 'assets' },
    filters: { assets: defaultFilters(), pending: defaultFilters() },
    returnStack: [],
    domSnapshots: {},
  };
}

export function librarySetProject(ui, projectId) {
  if (ui.projectId !== projectId) Object.assign(ui, createLibraryUiState(projectId));
  return ui;
}

export function libraryAssetPin(asset, contentKind = asset?.contentKind ?? 'image') {
  if (!CONTENT_KINDS.has(contentKind) || typeof asset?.assetId !== 'string'
      || !positiveVersion(asset.assetVersion) || !positiveVersion(asset.metadataVersion)) return null;
  return { contentKind, assetId: asset.assetId, assetVersion: asset.assetVersion, metadataVersion: asset.metadataVersion };
}

function assertRoute(route) {
  if (route?.view === 'list' && ['assets', 'pending'].includes(route.tab)) return;
  if (route?.view === 'detail' && route.pin && libraryAssetPin(route.pin, route.pin.contentKind)) return;
  // Proposed content has an exact proposal identity, not a fabricated saved Asset version.
  if (route?.view === 'detail' && route.proposed && validReview(route.proposed)) return;
  if (route?.view === 'review' && validReview(route)) return;
  throw new Error('Choose an exact Library list, saved Asset, or proposal identity.');
}

function validReview(value) {
  return (CONTENT_KINDS.has(value?.contentKind) || value?.contentKind === 'review') && typeof value.proposalId === 'string'
    && value.proposalId.length > 0 && positiveVersion(value.proposalVersion);
}

export function libraryRouteKey(route) {
  assertRoute(route);
  if (route.view === 'list') return JSON.stringify(['list', route.tab]);
  if (route.view === 'review') return JSON.stringify(['review', route.contentKind, route.proposalId, route.proposalVersion, ...(route.readOnly ? ['history'] : [])]);
  const pin = route.pin, proposed = route.proposed;
  return JSON.stringify(['detail', pin?.contentKind ?? proposed?.contentKind, pin?.assetId ?? route.assetId ?? null,
    pin?.assetVersion ?? null, pin?.metadataVersion ?? null,
    proposed?.proposalId ?? null, proposed?.proposalVersion ?? null, route.itemId ?? null]);
}

/** Returns the new route. The caller captures and restores DOM using domSnapshots. */
export function libraryNavigate(ui, route, { domSnapshot = null, replace = false } = {}) {
  const nextKey = libraryRouteKey(route), currentKey = libraryRouteKey(ui.route);
  if (domSnapshot !== null) ui.domSnapshots[currentKey] = copy(domSnapshot);
  if (!replace && nextKey !== currentKey) {
    ui.returnStack.push(copy(ui.route));
    if (ui.returnStack.length > 24) ui.returnStack.shift();
  }
  ui.route = copy(route);
  if (route.view === 'list') ui.tab = route.tab;
  const keys = Object.keys(ui.domSnapshots);
  for (const key of keys.slice(0, Math.max(0, keys.length - 48))) delete ui.domSnapshots[key];
  return ui.route;
}

/** Returns the restored route, or null when no return destination was retained. */
export function libraryBack(ui) {
  const route = ui.returnStack.pop();
  if (!route) return null;
  ui.route = route;
  if (route.view === 'list') ui.tab = route.tab;
  return route;
}

function records(snapshot) {
  return [
    ...(snapshot?.assetLibrary?.assets ?? []).map(asset => ({ contentKind: 'image', asset })),
    ...(snapshot?.clipLibrary?.assets ?? []).map(asset => ({ contentKind: 'animation', asset })),
    ...(snapshot?.assemblyLibrary?.assets ?? []).map(asset => ({ contentKind: 'assembly', asset })),
  ];
}

/** Preserve one row per actual proposal; shared tasks do not imply a shared transaction. */
export function libraryReviewGroups(snapshot) {
  const groups = [];
  const shared = snapshot?.reviewLibrary?.groups ?? [];
  const adopted = new Set(shared.filter(group => group.legacySource).map(group => `${group.legacySource.contentKind}:${group.legacySource.proposalId}`));
  for (const [contentKind, library] of [
    ['image', snapshot?.assetLibrary], ['animation', snapshot?.clipLibrary], ['assembly', snapshot?.assemblyLibrary],
  ]) {
    for (const proposal of library?.proposals ?? []) {
      if (adopted.has(`${contentKind}:${proposal.proposalId}`)) continue;
      const native = contentKind === 'image', changes = native ? proposal.items ?? [] : [proposal.content].filter(Boolean);
      const status = native ? proposal.state : proposal.status;
      const pending = native ? ['PENDING', 'DECIDED'].includes(status) : ['PENDING', 'CHANGES_REQUESTED'].includes(status);
      const names = changes.map(item => item.name ?? item.assetId).filter(Boolean);
      const title = names.length === 1 ? names[0] : names.length ? `${names[0]} + ${names.length - 1} more` : proposal.proposalId;
      const actorId = native ? proposal.proposer?.actor?.id ?? null : proposal.proposerActorId ?? null;
      const actorName = native ? proposal.proposer?.actor?.displayName ?? actorId : actorId;
      const taskId = native ? proposal.proposer?.taskId ?? null : proposal.proposerTaskId ?? null;
      groups.push({
        key: `${contentKind}:${proposal.proposalId}`, contentKind,
        proposalId: proposal.proposalId, proposalVersion: proposal.proposalVersion,
        proposal, status, pending, changeCount: changes.length, title,
        assetIds: [...new Set(changes.map(item => item.assetId).filter(Boolean))],
        useKinds: [...new Set(changes.map(item => item.kind).filter(value => USE_KINDS.has(value)))],
        actorId, actorName, actorKind: native ? proposal.proposer?.actor?.kind : proposal.proposerActorKind, taskId, revision: native ? proposal.submittedRevision : proposal.createdRevision,
        searchText: textKey([proposal.proposalId, ...names, actorName, actorId, taskId, status].filter(Boolean).join(' ')),
      });
    }
  }
  for (const proposal of shared) {
    const pending = ['PENDING', 'CHANGES_REQUESTED'].includes(proposal.status);
    const remaining = proposal.items.filter(item => item.status === 'PENDING');
    const affected = pending ? remaining : proposal.items;
    groups.push({ key: `review:${proposal.reviewId}`, contentKind: 'review', contentKinds: [...new Set(proposal.items.map(item => item.contentKind))],
      proposalId: proposal.reviewId, proposalVersion: proposal.reviewVersion, proposal, status: proposal.status, pending,
      changeCount: affected.length, acceptedCount: proposal.items.filter(item => item.status === 'ACCEPTED').length, title: proposal.title,
      assetIds: [...new Set(affected.map(item => item.payload.assetId))], useKinds: [...new Set(proposal.items.map(item => item.payload.kind))],
      actorId: proposal.proposer.actor.id, actorName: proposal.proposer.actor.displayName ?? proposal.proposer.actor.id, actorKind: proposal.proposer.actor.kind,
      taskId: proposal.proposer.taskId, revision: proposal.createdRevision,
      searchText: textKey([proposal.title, proposal.reviewId, proposal.status, proposal.proposer.actor.id, proposal.proposer.taskId, ...proposal.items.map(item => item.payload.name)].filter(Boolean).join(' ')) });
  }
  return groups;
}

function sourceNamesFor(asset, snapshot, allRecords, visited = new Set()) {
  const identity = `${asset.assetId}@${asset.assetVersion}:${asset.metadataVersion}`;
  if (visited.has(identity)) return [];
  visited.add(identity);
  const result = new Set();
  const sources = new Map((snapshot?.sources ?? []).map(source => [source.sourceId ?? source.id, source.name]));
  const atlases = new Map((snapshot?.atlases ?? []).map(atlas => [atlas.atlasId ?? atlas.id, atlas]));
  const addBinding = binding => {
    if (!binding) return;
    const atlas = atlases.get(binding.atlasId);
    for (const value of [sources.get(binding.sourceId), atlas?.name, binding.rectangle?.name, binding.sourceId, binding.atlasId, binding.sliceId]) {
      if (value) result.add(value);
    }
  };
  addBinding(asset.sliceBinding);
  for (const frame of asset.frameBindings ?? []) addBinding(frame.sliceBinding);
  for (const frame of asset.clip?.frames ?? []) {
    result.add(frame.name);
    result.add(frame.slice.sliceId);
    for (const atlas of atlases.values()) {
      const slice = atlas.sliceHeads?.find(value => value.sliceId === frame.slice.sliceId && value.version === frame.slice.sliceVersion);
      if (slice) addBinding({ ...slice, atlasId: atlas.atlasId ?? atlas.id, sourceId: slice.sourceId ?? atlas.sourceId });
    }
  }
  const pins = [];
  for (const component of asset.assembly?.components ?? []) {
    result.add(component.name);
    for (const slot of [component, ...(component.variantOverrides ?? []), ...(component.stateOverrides ?? [])]) {
      const pin = slot.asset ?? slot.content?.asset;
      if (pin) pins.push(pin);
    }
  }
  for (const pin of pins) {
    result.add(pin.assetId);
    const target = allRecords.find(entry => entry.asset.assetId === pin.assetId
      && entry.asset.assetVersion === pin.assetVersion && entry.asset.metadataVersion === pin.metadataVersion)?.asset;
    if (target) {
      result.add(target.name);
      for (const name of sourceNamesFor(target, snapshot, allRecords, visited)) result.add(name);
    }
  }
  return [...result].filter(Boolean);
}

/** Head inventory only. Proposed content is intentionally absent from these cards. */
export function libraryInventory(snapshot) {
  const allRecords = records(snapshot), groups = libraryReviewGroups(snapshot);
  return allRecords.map(({ contentKind, asset }) => {
    const sourceNames = sourceNamesFor(asset, snapshot, allRecords);
    return {
      key: `${contentKind}:${asset.assetId}`, contentKind, asset,
      pin: libraryAssetPin(asset, contentKind), sourceNames,
      searchText: textKey([asset.name, asset.assetId, ...(asset.metadata?.tags ?? []), ...sourceNames].join(' ')),
      relatedReviews: groups.filter(group => group.pending && (group.contentKind === contentKind || group.contentKinds?.includes(contentKind)) && group.assetIds.includes(asset.assetId)),
    };
  });
}

export function findLibraryItem(snapshot, pin) {
  if (!libraryAssetPin(pin, pin?.contentKind)) return null;
  return libraryInventory(snapshot).find(entry => entry.contentKind === pin.contentKind && entry.asset.assetId === pin.assetId
    && entry.asset.assetVersion === pin.assetVersion && entry.asset.metadataVersion === pin.metadataVersion) ?? null;
}

export function filterLibraryItems(items, filters = {}) {
  const search = textKey(filters.search).trim();
  return items.filter(item => (!search || textKey(item.searchText ?? item.title ?? item.asset?.name).includes(search))
    && (!filters.content || filters.content === 'all' || item.contentKind === filters.content || item.contentKinds?.includes(filters.content))
    && (!filters.use || filters.use === 'all' || (item.asset ? item.asset.kind === filters.use : item.useKinds?.includes(filters.use))));
}
