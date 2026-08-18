import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePngRgba } from "./art/toolkit/prop-source.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(root, "art-source/recipes/transfer-hall/robots/pico/source");
const outDir = join(root, "artifacts/grounding");
const FRAME_SIZE = 96;
const FRAME_NAMES = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

function canonicalSourceBytes() {
  const files = readdirSync(sourceDir)
    .filter((file) => file.startsWith("directional-pico-gold.b64."))
    .sort();
  if (files.length !== 4) throw new Error(`Expected 4 PICO source chunks, found ${files.length}.`);
  return Buffer.from(files.map((file) => readFileSync(join(sourceDir, file), "utf8").trim()).join(""), "base64");
}

function pixel(rgba, width, x, y) {
  const o = (y * width + x) * 4;
  return { r: rgba[o], g: rgba[o + 1], b: rgba[o + 2], a: rgba[o + 3] };
}

function saturation({ r, g, b }) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function luminance({ r, g, b }) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function boundsFor(points) {
  if (!points.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { x, y } of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, maxX, maxY };
}

function clustersAtFootPlane(points, footY) {
  const near = points.filter((p) => p.y >= footY - 4 && p.y <= footY + 1).sort((a, b) => a.x - b.x);
  if (!near.length) return [];
  const xs = [...new Set(near.map((p) => p.x))];
  const groups = [];
  let current = [xs[0]];
  for (let i = 1; i < xs.length; i += 1) {
    if (xs[i] <= xs[i - 1] + 2) current.push(xs[i]);
    else {
      groups.push(current);
      current = [xs[i]];
    }
  }
  groups.push(current);
  return groups
    .map((group) => ({ minX: group[0], maxX: group[group.length - 1], x: (group[0] + group[group.length - 1]) / 2 }))
    .filter((group) => group.maxX - group.minX >= 1)
    .sort((a, b) => (b.maxX - b.minX) - (a.maxX - a.minX))
    .slice(0, 2)
    .sort((a, b) => a.x - b.x);
}

function analyzeFrame(rgba, width, frameIndex) {
  const offsetX = frameIndex * FRAME_SIZE;
  const body = [];
  const visible = [];
  const shadowCandidates = [];
  const rowStats = [];

  for (let y = 0; y < FRAME_SIZE; y += 1) {
    let structuralCount = 0;
    let shadowCount = 0;
    for (let x = 0; x < FRAME_SIZE; x += 1) {
      const c = pixel(rgba, width, offsetX + x, y);
      if (c.a > 0) visible.push({ x, y, ...c });
      if (c.a >= 128) {
        body.push({ x, y, ...c });
        structuralCount += 1;
      }
      const lowAlpha = c.a >= 4 && c.a <= 120;
      const darkNeutral = luminance(c) <= 105 && saturation(c) <= 48;
      if (lowAlpha && darkNeutral && y >= 48) {
        shadowCandidates.push({ x, y, ...c });
        shadowCount += 1;
      }
    }
    rowStats.push({ y, structuralCount, shadowCount });
  }

  const bodyBounds = boundsFor(body);
  const visibleBounds = boundsFor(visible);
  const shadowBounds = boundsFor(shadowCandidates);
  const footY = bodyBounds?.maxY ?? 0;
  const contacts = clustersAtFootPlane(body, footY);
  const pixelsBelowBody = shadowCandidates.filter((p) => p.y > footY);
  const shadowBelowBounds = boundsFor(pixelsBelowBody);
  const broadRowsBelow = rowStats.filter((r) => r.y > footY && r.shadowCount >= 10);
  const bakedShadowLikely = pixelsBelowBody.length >= 30 && broadRowsBelow.length >= 2 && (shadowBelowBounds?.w ?? 0) >= 18;

  return {
    frameIndex,
    name: FRAME_NAMES[frameIndex],
    bodyBounds,
    visibleBounds,
    footY,
    contacts,
    transparentPaddingBelowFoot: FRAME_SIZE - 1 - footY,
    shadowCandidateCount: shadowCandidates.length,
    shadowBelowFootCount: pixelsBelowBody.length,
    shadowCandidateBounds: shadowBounds,
    shadowBelowFootBounds: shadowBelowBounds,
    broadShadowRowsBelowFoot: broadRowsBelow,
    bakedShadowLikely,
  };
}

function esc(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function diagnosticSvg(sourceBytes, analyses, sha256) {
  const scale = 4;
  const panelW = FRAME_SIZE * scale;
  const panelH = 450;
  const width = panelW * 4;
  const height = panelH * 2;
  const href = `data:image/png;base64,${sourceBytes.toString("base64")}`;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="#202526"/>`,
    `<style>text{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;fill:#e8efed}.small{font-size:12px}.title{font-size:17px;font-weight:700}.bad{fill:#ff7b72}.good{fill:#75d6a4}.foot{stroke:#ffcc66;stroke-width:2}.contact{fill:#ff4fd8;stroke:#170012;stroke-width:1}.bodybox{fill:none;stroke:#65d9ff;stroke-width:1}.shadowbox{fill:none;stroke:#ff765f;stroke-width:2;stroke-dasharray:5 3}</style>`,
  ];

  for (const analysis of analyses) {
    const col = analysis.frameIndex % 4;
    const row = Math.floor(analysis.frameIndex / 4);
    const ox = col * panelW;
    const oy = row * panelH;
    const srcX = analysis.frameIndex * FRAME_SIZE;
    parts.push(`<g transform="translate(${ox} ${oy})">`);
    parts.push(`<rect x="0" y="0" width="${panelW}" height="${panelW}" fill="#9da6a2"/>`);
    for (let y = 0; y < FRAME_SIZE; y += 8) {
      for (let x = 0; x < FRAME_SIZE; x += 8) {
        if (((x / 8) + (y / 8)) % 2 === 0) parts.push(`<rect x="${x * scale}" y="${y * scale}" width="${8 * scale}" height="${8 * scale}" fill="#c1c8c5"/>`);
      }
    }
    parts.push(`<svg x="0" y="0" width="${panelW}" height="${panelW}" viewBox="${srcX} 0 ${FRAME_SIZE} ${FRAME_SIZE}" preserveAspectRatio="none"><image href="${href}" x="0" y="0" width="768" height="96"/></svg>`);
    if (analysis.bodyBounds) {
      const b = analysis.bodyBounds;
      parts.push(`<rect class="bodybox" x="${b.x * scale}" y="${b.y * scale}" width="${b.w * scale}" height="${b.h * scale}"/>`);
    }
    if (analysis.shadowBelowFootBounds) {
      const s = analysis.shadowBelowFootBounds;
      parts.push(`<rect class="shadowbox" x="${s.x * scale}" y="${s.y * scale}" width="${s.w * scale}" height="${s.h * scale}"/>`);
    }
    parts.push(`<line class="foot" x1="0" x2="${panelW}" y1="${analysis.footY * scale}" y2="${analysis.footY * scale}"/>`);
    for (const c of analysis.contacts) parts.push(`<circle class="contact" cx="${c.x * scale}" cy="${analysis.footY * scale}" r="7"/>`);
    const ty = panelW + 22;
    parts.push(`<text class="title" x="8" y="${ty}">${analysis.frameIndex} · ${analysis.name}</text>`);
    parts.push(`<text class="small" x="8" y="${ty + 22}">footY=${analysis.footY} · padding=${analysis.transparentPaddingBelowFoot}px</text>`);
    parts.push(`<text class="small" x="8" y="${ty + 42}">contacts=${esc(JSON.stringify(analysis.contacts.map((c) => Number(c.x.toFixed(1)))))}</text>`);
    parts.push(`<text class="small" x="8" y="${ty + 62}">dark low-alpha below feet=${analysis.shadowBelowFootCount}</text>`);
    parts.push(`<text class="${analysis.bakedShadowLikely ? "small bad" : "small good"}" x="8" y="${ty + 82}">bakedShadowLikely=${analysis.bakedShadowLikely}</text>`);
    if (analysis.shadowBelowFootBounds) parts.push(`<text class="small" x="8" y="${ty + 102}">candidate=${esc(JSON.stringify(analysis.shadowBelowFootBounds))}</text>`);
    parts.push(`</g>`);
  }
  parts.push(`<text class="small" x="8" y="${height - 8}">source SHA-256 ${sha256}</text>`);
  parts.push(`</svg>`);
  return parts.join("\n");
}

const sourceBytes = canonicalSourceBytes();
const sha256 = createHash("sha256").update(sourceBytes).digest("hex");
if (sourceBytes.length !== 14617 || sha256 !== "cb392e02da021ee2e33031021c6e7f01051f98edc4a01d0e9386a320f31494c9") {
  throw new Error(`PICO canonical source mismatch: bytes=${sourceBytes.length}, sha256=${sha256}`);
}

const decoded = decodePngRgba(sourceBytes);
if (decoded.width !== 768 || decoded.height !== 96) throw new Error(`Unexpected PICO dimensions ${decoded.width}x${decoded.height}.`);
const analyses = FRAME_NAMES.map((_, index) => analyzeFrame(decoded.rgba, decoded.width, index));
const report = {
  generatedAt: new Date().toISOString(),
  source: { bytes: sourceBytes.length, sha256, width: decoded.width, height: decoded.height, frameSize: FRAME_SIZE },
  summary: {
    bakedShadowLikelyAnyFrame: analyses.some((a) => a.bakedShadowLikely),
    bakedShadowLikelyFrames: analyses.filter((a) => a.bakedShadowLikely).map((a) => a.name),
    footYRange: [Math.min(...analyses.map((a) => a.footY)), Math.max(...analyses.map((a) => a.footY))],
  },
  frames: analyses,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "pico-grounding-analysis.json"), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(join(outDir, "pico-grounding-diagnostic.svg"), diagnosticSvg(sourceBytes, analyses, sha256));
console.log(JSON.stringify(report, null, 2));