import { clipFrameAtTime } from '../../../packages/domain/src/clip-playback.js';
const NS = 'http://www.w3.org/2000/svg';
export function assemblySvg(tag, attributes = {}) { const node = document.createElementNS(NS, tag); for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value)); return node; }
export function assemblyArtifactUrl(projectId, digest) {
  if (!projectId || !/^[a-f0-9]{64}$/.test(digest ?? '')) throw new Error('This component has no exact project image.');
  return `/api/projects/${encodeURIComponent(projectId)}/artifacts/sha256/${digest}`;
}
export function assemblyRegionNode(region, attributes = {}) {
  const shape = region.shape; let node;
  if (shape.kind === 'polygon') node = assemblySvg('polygon', { points: shape.points.map(p => `${p.x},${p.y}`).join(' '), ...attributes });
  else if (shape.kind === 'oval') node = assemblySvg('ellipse', { cx: shape.x + shape.width / 2, cy: shape.y + shape.height / 2, rx: shape.width / 2, ry: shape.height / 2, ...attributes });
  else node = assemblySvg('rect', { x: shape.x, y: shape.y, width: shape.width, height: shape.height, ...attributes });
  if (region.transform) node.setAttribute('transform', `matrix(${region.transform.join(' ')})`); return node;
}
export function createAssemblyArtwork(scene, options = {}) {
  const root = assemblySvg('g', { 'data-assembly-artwork': '' }); updateAssemblyArtwork(root, scene, options); return root;
}
const playbackClocks = new WeakMap();
export function assemblyArtworkPlayback(root) { return [...(playbackClocks.get(root) ?? new Map()).entries()].map(([key, value]) => ({ key, elapsedMs: value.elapsedMs, frameIndex: value.frameIndex })); }
export function updateAssemblyArtwork(root, scene, { projectId, hidden = [], selectedComponentId = null, interactive = false, playing = false, now = performance.now() } = {}) {
  const prior = new Map([...root.children].map(node => [node.dataset.assemblyImageKey, node])); const desired = [];
  const clocks = playbackClocks.get(root) ?? new Map(); playbackClocks.set(root, clocks); const active = new Set();
  // SVG paints later siblings in front. The declaration is front to back.
  for (const item of [...(scene?.elements ?? [])].reverse()) {
    const key = `${item.componentId}:${item.asset.assetId}@${item.asset.assetVersion}:${item.asset.metadataVersion}`;
    let frame = item;
    if (item.contentKind === 'animation') {
      active.add(key); const clock = clocks.get(key) ?? { elapsedMs: 0, lastNow: null, frameIndex: 0 };
      if (playing && clock.lastNow !== null) clock.elapsedMs += Math.max(0, now - clock.lastNow);
      clock.lastNow = playing ? now : null; clock.frameIndex = clipFrameAtTime(item.clip, clock.elapsedMs).frameIndex;
      clocks.set(key, clock); frame = item.clip.frames[clock.frameIndex];
    }
    let group = prior.get(key); prior.delete(key);
    if (!group) {
      group = assemblySvg('g'); group.dataset.assemblyImageKey = key; group.dataset.assemblyComponent = item.componentId;
      const image = assemblySvg('image', { x: 0, y: 0, preserveAspectRatio: 'none', 'pointer-events': 'none' }); image.dataset.assemblyImage = ''; group.append(image);
      group.append(assemblySvg('rect', { x: 0, y: 0, fill: 'transparent', class: 'assembly-component-hit' }));
    }
    const image = group.querySelector('image'), hit = group.querySelector('rect'), size = frame.artifact.pixelSize;
    const href = assemblyArtifactUrl(projectId, frame.artifact.digest);
    if (image.getAttribute('href') !== href) image.setAttribute('href', href);
    for (const node of [image, hit]) { node.setAttribute('width', size.width); node.setAttribute('height', size.height); }
    group.dataset.assemblyContentKind = item.contentKind ?? 'image';
    if (item.contentKind === 'animation') group.dataset.assemblyFrame = frame.frameId; else delete group.dataset.assemblyFrame;
    group.setAttribute('transform', `matrix(${frame.imageMatrix.join(' ')})`);
    group.style.display = hidden.includes(item.componentId) ? 'none' : '';
    group.classList.toggle('selected', item.componentId === selectedComponentId);
    group.style.pointerEvents = interactive ? '' : 'none'; hit.style.pointerEvents = interactive ? 'all' : 'none'; desired.push(group);
  }
  for (const key of clocks.keys()) if (!active.has(key)) clocks.delete(key);
  for (const node of prior.values()) node.remove();
  desired.forEach((node, index) => { if (root.children[index] !== node) root.insertBefore(node, root.children[index] ?? null); });
  return root;
}
export function assemblySceneFrame(scene, assembly) {
  const bounds = assembly.placementBounds, visual = scene?.visualBounds;
  const points = [{ x: bounds.x, y: bounds.y }, { x: bounds.x + bounds.width, y: bounds.y + bounds.height }, assembly.anchor];
  if (visual) points.push({ x: visual.x, y: visual.y }, { x: visual.x + visual.width, y: visual.y + visual.height });
  const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
  const width = Math.max(1, Math.max(...points.map(p => p.x)) - x), height = Math.max(1, Math.max(...points.map(p => p.y)) - y), pad = Math.max(width, height) * .08;
  return { x: x - pad, y: y - pad, width: width + pad * 2, height: height + pad * 2 };
}
