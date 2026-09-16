const text = (value) => String(value ?? '').trim().toLocaleLowerCase();

export function createSourcesUiState() {
  return {
    tab: 'images',
    attention: 'all',
    search: '',
    importOpen: false,
  };
}

export function sourceNeedsReview(source) {
  return source?.lifecycle?.state === 'REVIEWED'
    && (source?.review?.disposition ?? 'PENDING') === 'PENDING';
}

export function sourceStatusPresentation(source) {
  const lifecycle = source?.lifecycle?.state ?? 'LEGACY_REGISTERED';
  const review = source?.review?.disposition ?? 'LEGACY_UNREVIEWED';
  if (lifecycle === 'APPROVED_SOURCE' && review === 'USER_APPROVED') {
    return {
      key: 'ready',
      label: 'Ready to use',
      explanation: 'This original is saved and approved. Image Workbench keeps it unchanged while you prepare outputs.',
    };
  }
  if (sourceNeedsReview(source)) {
    return {
      key: 'needs-review',
      label: 'Needs review',
      explanation: 'A human decision is required before this original can be used for image work.',
    };
  }
  if (['IMPORTED', 'GENERATED'].includes(lifecycle) && review === 'PENDING') {
    return {
      key: 'ready-to-submit',
      label: 'Ready to submit',
      explanation: 'The original is saved, but it has not yet been submitted for human review.',
    };
  }
  if (lifecycle === 'REJECTED_SOURCE' || review === 'USER_REJECTED') {
    return {
      key: 'not-approved',
      label: 'Not approved',
      explanation: 'This original remains recorded, but it cannot be used for new image work.',
    };
  }
  return {
    key: 'legacy',
    label: 'Existing source',
    explanation: 'This source predates the current review lifecycle. Its recorded identity remains unchanged.',
  };
}

export function filterSourceImages(sources, { search = '', attention = 'all' } = {}) {
  const query = text(search);
  return sources.filter((source) => {
    if (attention === 'needs-review' && !sourceNeedsReview(source)) return false;
    if (!query) return true;
    return [
      source.id,
      source.name,
      source.mediaType,
      source.provenance?.origin,
      source.provenance?.prompt,
      source.provenance?.provider,
      source.provenance?.model,
      sourceStatusPresentation(source).label,
    ].some((value) => text(value).includes(query));
  });
}

export function imageWorkbenchEntries(snapshot) {
  const sourceById = new Map((snapshot?.sources ?? []).map((source) => [source.id, source]));
  return (snapshot?.atlases ?? []).map((atlas) => ({
    atlas,
    source: sourceById.get(atlas.sourceId) ?? null,
  }));
}

export function workbenchStatusPresentation(entry) {
  const savedCuts = entry?.atlas?.sliceHeads?.length ?? 0;
  const rectangleCount = entry?.atlas?.rectangles?.length ?? 0;
  if (savedCuts > 0) {
    return {
      key: 'saved-outputs',
      label: `${savedCuts} saved ${savedCuts === 1 ? 'cut' : 'cuts'}`,
      explanation: 'These outputs remain linked to their original. Create Library content from a saved cut when it has the meaning you need.',
    };
  }
  return {
    key: 'saved-work',
    label: 'Saved work · nothing running',
    explanation: rectangleCount > 0
      ? 'The cut definition is saved. Open it to continue editing or prepare exact output images.'
      : 'The work item is saved, but no cuts have been defined yet.',
  };
}

export function filterImageWorkbench(entries, { search = '', attention = 'all' } = {}) {
  if (attention === 'needs-review') return [];
  const query = text(search);
  if (!query) return entries;
  return entries.filter((entry) => [
    entry.atlas?.id,
    entry.atlas?.name,
    entry.source?.id,
    entry.source?.name,
    workbenchStatusPresentation(entry).label,
  ].some((value) => text(value).includes(query)));
}
