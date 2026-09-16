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
      label: 'Approved',
      explanation: 'No review needed. This original stays unchanged when you create output images from it.',
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

// Saved cutting work has no owner-review lifecycle. Library reviews belong in Library.
export function sourceReviewCounts(snapshot) {
  return { images: (snapshot?.sources ?? []).filter(sourceNeedsReview).length, workbench: 0 };
}

export function savedOutputConsumers(snapshot, slice) {
  const matches = binding => binding?.sliceId === slice.sliceId && binding?.sliceVersion === slice.version;
  return [
    ...(snapshot?.assetLibrary?.assets ?? []).filter(asset => matches(asset.sliceBinding))
      .map(asset => ({ contentKind: 'image', asset })),
    ...(snapshot?.clipLibrary?.assets ?? []).filter(asset => (asset.clip?.frames ?? []).some(frame => matches(frame.slice)))
      .map(asset => ({ contentKind: 'animation', asset })),
  ];
}

export function cutterOutputPresentation({ job, dirty = false, savedCount = 0 } = {}) {
  const preview = job?.state === 'SUCCEEDED' && (job.outputs?.length ?? 0) > 0;
  const description = preview
    ? 'These generated images are not saved yet. Check them, then save them for use in Library assets. Previously saved images stay available.'
    : savedCount > 0
      ? 'These output images are saved. Open their Library links, or create a new asset with its own use, size and placement settings. Creating an asset is not another approval of the image.'
      : 'Choose the areas to keep in Cut images, save the cut layout, then generate output images.';
  return {
    kind: preview ? 'preview' : 'saved',
    label: preview ? 'Not saved yet' : savedCount > 0 ? 'Saved output images' : 'No output images yet',
    description: description + (dirty ? ' Your unsaved cut edits are not included in these images.' : ''),
    compare: preview && savedCount > 0,
  };
}

export function workbenchStatusPresentation(entry) {
  const savedCuts = entry?.atlas?.sliceHeads?.length ?? 0;
  const rectangleCount = entry?.atlas?.rectangles?.length ?? 0;
  if (savedCuts > 0) {
    return {
      key: 'saved-outputs',
      label: `${savedCuts} saved output ${savedCuts === 1 ? 'image' : 'images'}`,
      explanation: 'View the extracted images and their Library uses, or edit the areas cut from the original.',
    };
  }
  return {
    key: 'saved-work',
    label: 'Cut layout saved',
    explanation: rectangleCount > 0
      ? 'The selected areas are saved. Open this work to generate output images or continue editing.'
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
    ...(entry.atlas?.sliceHeads ?? []).map(slice => slice.rectangle?.name),
    workbenchStatusPresentation(entry).label,
  ].some((value) => text(value).includes(query)));
}
