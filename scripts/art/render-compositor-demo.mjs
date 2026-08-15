import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import {
  canonicalizeConnectorGroup,
  createMask,
  encodeRgbaPng,
  meanConnectorDifference,
  renderMaskedMaterial,
} from "./compositor2d.mjs";

const T = 64;
const TH = 24;
const MATERIAL_SIZE = 256;
const outDir = resolve("tmp/art-compositor-demo");
mkdirSync(outDir, { recursive: true });

function hash2d(x, y, seed) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise(x, y, scale, seed) {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = smoothstep(fx - x0);
  const ty = smoothstep(fy - y0);
  const a = hash2d(x0, y0, seed);
  const b = hash2d(x0 + 1, y0, seed);
  const c = hash2d(x0, y0 + 1, seed);
  const d = hash2d(x0 + 1, y0 + 1, seed);
  const ab = a + (b - a) * tx;
  const cd = c + (d - c) * tx;
  return ab + (cd - ab) * ty;
}

function graphiteSampler(x, y) {
  const broad = (valueNoise(x, y, 52, 220814) - 0.5) * 9.0;
  const medium = (valueNoise(x + 41, y - 17, 17, 9931) - 0.5) * 4.0;
  const fine = (hash2d(x, y, 71237) - 0.5) * 1.4;
  const v = broad + medium + fine;
  return [
    Math.max(35, Math.min(92, 61 + v * 0.92)),
    Math.max(37, Math.min(95, 65 + v)),
    Math.max(39, Math.min(98, 67 + v * 1.05)),
  ];
}

function materialPreview() {
  const rgba = Buffer.alloc(MATERIAL_SIZE * MATERIAL_SIZE * 4);
  for (let y = 0; y < MATERIAL_SIZE; y += 1) {
    for (let x = 0; x < MATERIAL_SIZE; x += 1) {
      const [r, g, b] = graphiteSampler(x, y);
      const o = (y * MATERIAL_SIZE + x) * 4;
      rgba[o] = Math.round(r);
      rgba[o + 1] = Math.round(g);
      rgba[o + 2] = Math.round(b);
      rgba[o + 3] = 255;
    }
  }
  return rgba;
}

function repeatHorizontal(tile, count) {
  const rgba = Buffer.alloc(T * count * T * 4);
  for (let y = 0; y < T; y += 1) {
    for (let n = 0; n < count; n += 1) {
      const srcStart = y * T * 4;
      const dstStart = (y * T * count + n * T) * 4;
      tile.copy(rgba, dstStart, srcStart, srcStart + T * 4);
    }
  }
  return rgba;
}

const hTopMask = createMask(T, T, (_x, y) => y < TH);
const connectors = [
  { side: "L", start: 0, end: TH },
  { side: "R", start: 0, end: TH },
];

const rendered = renderMaskedMaterial({
  width: T,
  height: T,
  mask: hTopMask,
  connectors,
  materialSampler: graphiteSampler,
  worldOffsetX: 0,
  worldOffsetY: 31,
  outerDarkPx: 5,
  outerDarkStrength: 0.28,
  innerHighlightCenterPx: 3,
  innerHighlightWidthPx: 1.35,
  innerHighlightStrength: 0.035,
});

const tiles = [Buffer.from(rendered.rgba)];
const pairA = { tile: 0, side: "L", start: 0, end: TH };
const pairB = { tile: 0, side: "R", start: 0, end: TH };
const before = meanConnectorDifference({ width: T, height: T, tiles, a: pairA, b: pairB });
canonicalizeConnectorGroup({ width: T, height: T, tiles, members: [pairA, pairB], blendPx: 6 });
const after = meanConnectorDifference({ width: T, height: T, tiles, a: pairA, b: pairB });

const material = materialPreview();
const run3 = repeatHorizontal(tiles[0], 3);

const outputs = [
  ["material.png", encodeRgbaPng({ width: MATERIAL_SIZE, height: MATERIAL_SIZE, rgba: material })],
  ["h-top.png", encodeRgbaPng({ width: T, height: T, rgba: tiles[0] })],
  ["h-top-run3.png", encodeRgbaPng({ width: T * 3, height: T, rgba: run3 })],
];

for (const [name, bytes] of outputs) {
  writeFileSync(resolve(outDir, name), bytes);
  const hash = createHash("sha256").update(bytes).digest("hex");
  console.log(`${name}: ${bytes.length} bytes sha256=${hash.slice(0, 16)}…`);
}

console.log(`connector diff before canonicalization: ${before.toFixed(3)}`);
console.log(`connector diff after canonicalization : ${after.toFixed(3)}`);
console.log(`wrote demo to ${outDir}`);
