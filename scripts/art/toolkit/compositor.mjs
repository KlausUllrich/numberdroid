import { distanceFromBoundary, exposedBoundaryMask } from "./masks.mjs";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function renderMaskedMaterial({
  width,
  height,
  mask,
  connectors = [],
  materialSampler,
  worldOffsetX = 0,
  worldOffsetY = 0,
  outerDarkPx = 5,
  outerDarkStrength = 0.28,
  innerHighlightCenterPx = 3,
  innerHighlightWidthPx = 1.35,
  innerHighlightStrength = 0.035,
}) {
  const boundary = exposedBoundaryMask({ width, height, mask, connectors });
  const distance = distanceFromBoundary({ width, height, mask, boundary });
  const rgba = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x;
      const offset = p * 4;
      if (!mask[p]) continue;

      const [mr, mg, mb] = materialSampler(x + worldOffsetX, y + worldOffsetY);
      const d = distance[p] < 0 ? 999 : distance[p];
      const darkWeight = Math.max(0, 1 - d / Math.max(1, outerDarkPx));
      const darkFactor = 1 - outerDarkStrength * darkWeight;
      const hd = (d - innerHighlightCenterPx) / Math.max(0.001, innerHighlightWidthPx);
      const highlight = Math.exp(-0.5 * hd * hd) * innerHighlightStrength;
      const channels = [mr, mg, mb];

      for (let c = 0; c < 3; c += 1) {
        rgba[offset + c] = clamp(Math.round(channels[c] * darkFactor + 255 * highlight), 0, 255);
      }
      rgba[offset + 3] = 255;
    }
  }

  return { rgba, boundary, distance };
}
