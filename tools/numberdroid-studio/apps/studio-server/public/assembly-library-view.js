import { assemblySvg, createAssemblyArtwork, assemblySceneFrame } from './assembly-artwork-view.js';

const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
const openButton = (asset, text, focus) => { const button = el('button', 'secondary', text); button.type = 'button'; button.dataset.assemblyOpen = asset.assetId;
  button.dataset.assetFocusKey = `assembly-${focus}-${asset.assetId}`; return button; };
const dimension = value => Number.isInteger(value) ? String(value) : Number(value.toFixed(3)).toString();

/** Render an exact resolved scene supplied by the Library query owner. No head resolution or writes occur here. */
export function renderAssemblyCard({ asset, scene = null, projectId }) {
  const article = el('article', 'card asset-card asset-v2-card assembly-library-card'); article.dataset.assemblyAssetId = asset.assetId;
  const preview = openButton(asset, '', 'preview'); preview.classList.add('assembly-library-preview'); preview.setAttribute('aria-label', `Open ${asset.name} Assembly`);
  preview.style.width = '100%'; preview.style.height = '190px'; preview.style.padding = '8px'; preview.style.background = '#102018';
  if (scene) {
    const frame = assemblySceneFrame(scene, asset.assembly), picture = assemblySvg('svg', { viewBox: `${frame.x} ${frame.y} ${frame.width} ${frame.height}`, role: 'img', 'aria-label': `${asset.name} — exact component composition` });
    picture.style.width = '100%'; picture.style.height = '100%'; picture.append(createAssemblyArtwork(scene, { projectId })); preview.append(picture);
  } else preview.append(el('span', 'assembly-note', 'Exact component preview is not available yet. Open the Assembly to resolve its saved versions.'));
  article.append(preview);
  const headingRow = el('div', 'asset-card-heading'), heading = el('div'); heading.append(el('span', 'tag', `${asset.kind} · Assembly`), el('h3', '', asset.name));
  headingRow.append(heading, el('span', 'status-pill', asset.lifecycle ?? 'DRAFT')); article.append(headingRow);
  if (asset.metadata?.tags?.length) article.append(el('p', 'asset-tags', asset.metadata.tags.join(' · ')));
  const a = asset.assembly, size = `${dimension(a.placementBounds.width * a.unitsPerPixel)} × ${dimension(a.placementBounds.height * a.unitsPerPixel)} units`;
  const summary = el('dl', 'property-list asset-summary');
  for (const [name, value] of [['Content', `${a.components.length} component${a.components.length === 1 ? '' : 's'}`], ['Placement space', size], ['Presentation', `${a.variants.length} variant${a.variants.length === 1 ? '' : 's'} · ${a.states.length} state${a.states.length === 1 ? '' : 's'}`], ['Version', `Asset v${asset.assetVersion} · metadata v${asset.metadataVersion}`], ['Blocking', a.blocking.mode === 'custom' ? 'Custom Assembly shapes' : 'Inherited from components']]) summary.append(el('dt', '', name), el('dd', '', value));
  article.append(summary, el('p', 'assembly-note', 'Library composition · Room placement is not supported yet.'));
  const actions = el('div', 'asset-card-actions'); actions.append(openButton(asset, 'Open Assembly', 'open')); article.append(actions); return article;
}
