import { assemblySceneFrame } from './assembly-artwork-view.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DIGEST = /^[a-f0-9]{64}$/;
const CONTENT_LABELS = { image: 'Image', animation: 'Animation', assembly: 'Assembly' };
const number = value => Number.isInteger(value) ? String(value) : Number(value.toFixed(3)).toString();
const escaped = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

export function libraryElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function libraryContentLabel(contentKind) {
  return CONTENT_LABELS[contentKind] ?? 'Unsupported content';
}

export function setLibraryAssetIdentity(node, entry) {
  const asset = entry?.asset ?? entry, kind = entry?.contentKind ?? asset?.contentKind ?? 'image';
  node.dataset.libraryKind = kind;
  node.dataset.contentKind = kind;
  if (asset?.assetId) {
    node.dataset.libraryAssetId = asset.assetId;
    node.dataset.assetId = asset.assetId;
  }
  for (const field of ['assetVersion', 'metadataVersion']) {
    if (Number.isSafeInteger(asset?.[field]) && asset[field] > 0) {
      node.dataset[`library${field[0].toUpperCase()}${field.slice(1)}`] = String(asset[field]);
      node.dataset[field] = String(asset[field]);
    }
  }
  return node;
}

export function setLibraryReviewIdentity(node, group) {
  node.dataset.libraryKind = group.contentKind;
  node.dataset.contentKind = group.contentKind;
  node.dataset.libraryProposalId = group.proposalId;
  node.dataset.proposalId = group.proposalId;
  node.dataset.libraryProposalVersion = String(group.proposalVersion);
  return node;
}

export function libraryAction(action, label, { entry = null, group = null, className = 'secondary' } = {}) {
  const node = libraryElement('button', className, label);
  node.type = 'button';
  node.dataset.libraryAction = action;
  if (entry) setLibraryAssetIdentity(node, entry);
  if (group) setLibraryReviewIdentity(node, group);
  node.dataset.assetFocusKey = `library:${action}:${group?.key ?? entry?.key ?? 'navigation'}`;
  return node;
}

function checkedNumber(value, { positive = false } = {}) {
  if (!Number.isFinite(value) || Math.abs(value) > 4_000_000 || (positive && value <= 0)) {
    throw new Error('The exact artwork has unsupported preview dimensions.');
  }
  return value;
}

function checkedBounds(value) {
  return {
    x: checkedNumber(value.x), y: checkedNumber(value.y),
    width: checkedNumber(value.width, { positive: true }), height: checkedNumber(value.height, { positive: true }),
  };
}

function artifactPath(projectId, artifact) {
  if (typeof projectId !== 'string' || !projectId || !DIGEST.test(artifact?.digest ?? '')
      || artifact.mediaType !== 'image/png' || (artifact.projectId && artifact.projectId !== projectId)) {
    throw new Error('The exact project image is unavailable or unsupported.');
  }
  return `/api/projects/${encodeURIComponent(projectId)}/artifacts/sha256/${artifact.digest}`;
}

function imageDescriptor(projectId, artifact, { x = 0, y = 0, matrix = null } = {}) {
  const href = artifactPath(projectId, artifact);
  const size = artifact.pixelSize ?? artifact;
  if (matrix && (!Array.isArray(matrix) || matrix.length !== 6 || matrix.some(value => !Number.isFinite(value) || Math.abs(value) > 4_000_000))) {
    throw new Error('The exact artwork transform is unavailable.');
  }
  return {
    href, x: checkedNumber(x), y: checkedNumber(y),
    width: checkedNumber(size.width, { positive: true }), height: checkedNumber(size.height, { positive: true }),
    ...(matrix ? { matrix: [...matrix] } : {}),
  };
}

function animationPreview(record, projectId) {
  const clip = record.clip;
  if (!clip?.frames?.length || !Array.isArray(record.frameBindings)) throw new Error('The exact saved Animation frames are not available yet.');
  const bounds = checkedBounds({ x: 0, y: 0, ...clip.canvas });
  let left = 0, top = 0, right = bounds.width, bottom = bounds.height;
  const images = clip.frames.map(frame => {
    const binding = record.frameBindings.find(item => item.frameId === frame.frameId)?.sliceBinding;
    if (!binding || binding.sliceId !== frame.slice.sliceId || binding.sliceVersion !== frame.slice.sliceVersion) {
      throw new Error('An exact saved Animation frame is unavailable.');
    }
    const image = imageDescriptor(projectId, binding, frame.offset);
    left = Math.min(left, image.x); top = Math.min(top, image.y);
    right = Math.max(right, image.x + image.width); bottom = Math.max(bottom, image.y + image.height);
    return image;
  });
  return {
    bounds: checkedBounds({ x: left, y: top, width: right - left, height: bottom - top }),
    images: [images[0]],
    label: `Animation · paused at frame 1 of ${clip.frames.length}`,
  };
}

/** One exact, paused representation is shared by cards, Details and the new-tab document. */
export function libraryPreviewDescriptor({ entry, record = entry?.asset, scene = record?.scene, projectId, proposed = false }) {
  if (!record) throw new Error('This exact saved content is unavailable.');
  if (!proposed && entry?.pin && (record.assetId !== entry.pin.assetId || record.assetVersion !== entry.pin.assetVersion
      || record.metadataVersion !== entry.pin.metadataVersion)) throw new Error('This exact saved Asset version is unavailable.');
  const kind = entry?.contentKind ?? record.contentKind ?? 'image';
  if (kind === 'image') {
    const image = imageDescriptor(projectId, record.sliceBinding);
    return { bounds: { x: 0, y: 0, width: image.width, height: image.height }, images: [image], label: 'Image · whole saved image' };
  }
  if (kind === 'animation') return animationPreview(record, projectId);
  if (kind !== 'assembly' || !record.assembly || !Array.isArray(scene?.elements)) {
    throw new Error('The exact saved Assembly presentation is unavailable.');
  }
  const images = [...scene.elements].reverse().map(item => {
    const frame = item.contentKind === 'animation' ? item.clip?.frames?.[0] : item;
    if (!frame?.artifact || !frame.imageMatrix) throw new Error('An exact Assembly component is unavailable.');
    return imageDescriptor(projectId, frame.artifact, { matrix: frame.imageMatrix });
  });
  const assembly = record.assembly;
  const state = assembly.states?.find(value => value.stateId === (scene.stateId ?? assembly.defaultStateId));
  const variant = assembly.variants?.find(value => value.variantId === (scene.variantId ?? assembly.defaultVariantId));
  return {
    bounds: checkedBounds(assemblySceneFrame(scene, assembly)), images,
    label: `Assembly · ${state?.name ?? 'saved presentation'}${variant?.name ? ` · ${variant.name}` : ''} · paused`,
  };
}

function svgNode(tag, attributes = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

export function createLibraryPreview(options) {
  const container = libraryElement('div', 'library-artwork asset-preview');
  container.dataset.libraryArtwork = '';
  try {
    const descriptor = libraryPreviewDescriptor(options), bounds = descriptor.bounds;
    const fail = () => {
      container.dataset.libraryPreviewState = 'unavailable';
      container.dataset.previewState = 'UNAVAILABLE';
      container.replaceChildren(libraryElement('p', 'library-preview-unavailable', 'The exact saved image could not be loaded. Reopen the detail to retry.'));
    };
    if ((options.entry?.contentKind ?? options.record?.contentKind ?? 'image') === 'image') {
      const picture = libraryElement('img');
      picture.src = descriptor.images[0].href;
      picture.alt = `${options.record?.name ?? options.entry?.asset?.name ?? 'Image'} — whole saved image`;
      picture.width = bounds.width; picture.height = bounds.height;
      picture.addEventListener('error', fail, { once: true });
      container.dataset.libraryPreviewState = 'ready';
      container.dataset.previewState = 'READY';
      container.append(picture);
      return container;
    }
    const picture = svgNode('svg', {
      viewBox: `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`,
      width: bounds.width, height: bounds.height, preserveAspectRatio: 'xMidYMid meet',
      role: 'img', 'aria-label': `${options.record?.name ?? options.entry?.asset?.name ?? 'Content'} — ${descriptor.label}`,
    });
    for (const image of descriptor.images) {
      const { matrix, ...attributes } = image;
      const node = svgNode('image', { ...attributes, preserveAspectRatio: 'none', ...(matrix ? { transform: `matrix(${matrix.join(' ')})` } : {}) });
      node.addEventListener('error', fail, { once: true });
      picture.append(node);
    }
    container.dataset.libraryPreviewState = 'ready';
    container.dataset.previewState = 'READY';
    container.append(picture);
    if (!descriptor.images.length) container.append(libraryElement('span', 'library-empty-presentation', 'This saved presentation has no visible components.'));
  } catch (error) {
    container.dataset.libraryPreviewState = 'unavailable';
    container.dataset.previewState = 'UNAVAILABLE';
    container.append(libraryElement('p', 'library-preview-unavailable', options.unavailable ?? error.message));
  }
  return container;
}

export function safeLibraryPreviewUrl(value, projectId) {
  if (typeof value !== 'string') return null;
  const prefix = `/api/projects/${encodeURIComponent(projectId)}/artifacts/sha256/`;
  if (value.startsWith(prefix) && DIGEST.test(value.slice(prefix.length))) return value;
  const origin = globalThis.location?.origin;
  if (origin && value.startsWith(`${origin}${prefix}`) && DIGEST.test(value.slice(origin.length + prefix.length))) return value;
  if (origin && value.startsWith(`blob:${origin}/`) && /^[a-zA-Z0-9-]+$/.test(value.slice(`blob:${origin}/`.length))) return value;
  return null;
}

export function createLibraryPreviewLink({ entry, projectId, previewUrl, record = entry?.asset, scene = record?.scene, unavailable, proposed = false }) {
  const href = safeLibraryPreviewUrl(previewUrl, projectId);
  const link = href ? libraryElement('a', 'library-preview-link') : libraryAction('preview', '', { entry, className: 'library-preview-link' });
  if (href) {
    link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer';
    setLibraryAssetIdentity(link, entry);
    link.dataset.assetFocusKey = `library:preview:${entry?.key}`;
  }
  link.dataset.libraryPreviewLink = '';
  link.setAttribute('aria-label', `Open whole ${record?.name ?? 'content'} preview in a new tab`);
  link.append(createLibraryPreview({ entry, record, scene, projectId, unavailable, proposed }));
  return link;
}

export function libraryContentSummary(asset, contentKind = asset?.contentKind ?? 'image') {
  if (contentKind === 'image') {
    const size = asset.sliceBinding ?? asset.metadata?.pixelSize;
    return size?.width && size?.height ? `${number(size.width)} × ${number(size.height)} px` : 'Saved image';
  }
  if (contentKind === 'animation') {
    const clip = asset.clip;
    return clip ? `${number(clip.canvas.width)} × ${number(clip.canvas.height)} px · ${clip.frames.length} frames` : 'Saved Animation';
  }
  const a = asset.assembly;
  return a ? `${a.components.length} components · ${number(a.placementBounds.width * a.unitsPerPixel)} × ${number(a.placementBounds.height * a.unitsPerPixel)} units` : 'Saved Assembly';
}

export function renderLibraryDetail({ entry, record = entry?.asset, scene = record?.scene, projectId,
  previewUrl = null, sourceLabels = null, pendingGroups = entry?.relatedReviews ?? [], canEdit = false,
  unavailable = null, proposed = false, proposal = null, stale = false } = {}) {
  const page = libraryElement('section', 'library-detail');
  page.dataset.libraryDetail = '';
  setLibraryAssetIdentity(page, entry);
  if (proposal) setLibraryReviewIdentity(page, { contentKind: entry.contentKind, ...proposal });
  if (proposed) page.dataset.libraryProposed = 'true';
  const top = libraryElement('div', 'library-detail-toolbar');
  top.append(libraryAction('back', proposed ? 'Back to review' : 'Back', { entry }));
  if (!proposed) {
    const edit = libraryAction('edit', `Edit ${libraryContentLabel(entry?.contentKind)}`, { entry, className: 'primary' });
    edit.disabled = !canEdit || Boolean(stale) || !record || Boolean(unavailable);
    top.append(edit);
  }
  page.append(top);
  const heading = libraryElement('header', 'library-detail-heading');
  heading.append(libraryElement('p', 'library-eyebrow', `${libraryContentLabel(entry?.contentKind)} · ${record?.kind ?? entry?.asset?.kind ?? 'saved content'}`),
    libraryElement('h2', '', record?.name ?? entry?.asset?.name ?? 'Unavailable content'));
  page.append(heading);
  if (proposed) {
    page.append(libraryElement('p', 'library-notice', `Proposed content · read-only inspection${proposal?.proposalId ? ` · ${proposal.proposalId} v${proposal.proposalVersion}` : ''}. Return to review to make a decision.`));
  } else if (pendingGroups.length) {
    const notice = libraryElement('div', 'library-notice');
    notice.append(libraryElement('p', '', 'This is the saved version. Pending changes have not been applied.'));
    for (const group of pendingGroups) notice.append(libraryAction('review', `Review ${group.title}`, { group }));
    page.append(notice);
  }
  if (stale) page.append(libraryElement('p', 'library-notice', typeof stale === 'string' ? stale : 'This exact saved version is retained for inspection. The current Asset has changed; return to the Library before editing.'));
  if (unavailable) page.append(libraryElement('p', 'library-notice library-error', unavailable));
  const body = libraryElement('div', 'library-detail-body'), artwork = libraryElement('div', 'library-detail-preview');
  artwork.append(createLibraryPreviewLink({ entry, record, scene, projectId, previewUrl, unavailable, proposed }));
  let presentation = `${libraryContentLabel(entry?.contentKind)} · exact content preview`;
  try { presentation = libraryPreviewDescriptor({ entry, record, scene, projectId, proposed }).label; } catch { /* The preview supplies its exact failure. */ }
  artwork.append(libraryElement('p', 'library-preview-caption', `${presentation} · open picture for full-size inspection`));
  body.append(artwork);
  const metadata = libraryElement('aside', 'library-detail-metadata');
  const summary = libraryElement('dl', 'library-detail-properties');
  const row = (label, value) => {
    if (value === undefined || value === null || value === '') return;
    summary.append(libraryElement('dt', '', label), libraryElement('dd', '', String(value)));
  };
  row('Content', libraryContentLabel(entry?.contentKind));
  row('Use', record?.kind);
  if (record) row('Size', libraryContentSummary(record, entry?.contentKind));
  if (!proposed && record?.assetVersion) row('Saved version', `Asset v${record.assetVersion} · metadata v${record.metadataVersion}`);
  row('Status', proposed ? 'Proposed · not saved' : record?.lifecycle ?? 'Saved');
  row('Role', record?.metadata?.role);
  row('Tags', record?.metadata?.tags?.join(' · '));
  if (record?.clip) row('Playback', `${({ once: 'Play once', loop: 'Loop', pingpong: 'Ping-pong' })[record.clip.playbackMode] ?? record.clip.playbackMode} · ${record.clip.fps} fps`);
  if (record?.assembly) row('Blocking', record.assembly.blocking.mode === 'custom' ? 'Custom Assembly shapes' : 'Inherited from components');
  const sources = Array.isArray(sourceLabels) ? sourceLabels : typeof sourceLabels === 'string' ? [sourceLabels] : entry?.sourceNames ?? [];
  if (sources.length) row('Sources and relationships', [...new Set(sources)].join(' · '));
  if (record?.sliceBinding) {
    row('Saved cut', `${record.sliceBinding.rectangle?.name ?? record.sliceBinding.sliceId} · v${record.sliceBinding.sliceVersion}`);
    row('Source', record.sliceBinding.sourceId);
  }
  metadata.append(summary);
  const controls = libraryElement('div', 'library-detail-controls');
  controls.dataset.libraryDetailControls = '';
  metadata.append(controls); body.append(metadata); page.append(body);
  const members = record?.clip?.frames ?? record?.assembly?.components;
  if (members) {
    const section = libraryElement('details', 'library-member-details'), frames = Boolean(record.clip);
    section.append(libraryElement('summary', '', `${frames ? 'Frames' : 'Components'} (${members.length})`));
    const list = libraryElement('ol', 'library-member-list');
    for (const member of members) {
      const item = libraryElement('li');
      item.append(libraryElement('strong', '', member.name));
      const pin = frames ? member.slice : member.asset ?? member.content?.asset;
      const note = frames ? `${pin.sliceId} · cut v${pin.sliceVersion}${member.durationMs ? ` · ${member.durationMs} ms` : ''}`
        : pin ? `${pin.assetId} · Asset v${pin.assetVersion} · metadata v${pin.metadataVersion}` : 'No base content · inspect the authored presentation in the editor';
      item.append(libraryElement('span', '', note)); list.append(item);
    }
    section.append(list); page.append(section);
  }
  return page;
}

/** Static browser inspection only: no scripts, editor controls, uploads or artifact writes. */
export function createLibraryPreviewDocument(options) {
  const descriptor = libraryPreviewDescriptor(options), record = options.record ?? options.entry?.asset;
  const parsedOrigin = new URL(options.origin ?? globalThis.location?.origin);
  if (!['http:', 'https:'].includes(parsedOrigin.protocol) || parsedOrigin.username || parsedOrigin.password
      || parsedOrigin.search || parsedOrigin.hash || parsedOrigin.pathname !== '/'
      || (globalThis.location?.origin && parsedOrigin.origin !== globalThis.location.origin)) throw new Error('Use the current Studio origin for preview images.');
  const origin = parsedOrigin.origin, bounds = descriptor.bounds;
  const title = `${record.name} — ${options.proposed ? 'Proposed' : 'Saved'} ${libraryContentLabel(options.entry?.contentKind ?? record.contentKind ?? 'image')}`;
  const images = descriptor.images.map(image => `<image href="${escaped(`${origin}${image.href}`)}" x="${image.x}" y="${image.y}" width="${image.width}" height="${image.height}" preserveAspectRatio="none"${image.matrix ? ` transform="matrix(${image.matrix.join(' ')})"` : ''}/>`).join('\n');
  const policy = `default-src 'none'; img-src ${origin}; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${escaped(policy)}"><title>${escaped(title)}</title>
<style>html{color-scheme:dark;background:#111a18;color:#e8efea;font:16px/1.5 system-ui,sans-serif}body{margin:24px}h1{font-size:22px;margin:0 0 8px}p{color:#b7c8bd;max-width:80ch}svg{display:block;background:#17221e;border:1px solid #42534a}header{margin-bottom:20px}.note{font-size:14px}</style></head>
<body><header><h1>${escaped(title)}</h1><p>${escaped(descriptor.label)} · ${number(bounds.width)} × ${number(bounds.height)} px inspection frame${record.assetVersion && !options.proposed ? ` · saved Asset v${record.assetVersion}` : ''}.</p><p class="note">Read-only full-size inspection. Animation is paused; this view does not run game behavior. ${descriptor.images.length ? 'If an image cannot load, return to Studio and reopen its detail.' : 'This saved presentation has no visible components.'}</p></header>
<svg xmlns="${SVG_NS}" width="${bounds.width}" height="${bounds.height}" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escaped(title)}">${images}</svg>
</body></html>`;
}
