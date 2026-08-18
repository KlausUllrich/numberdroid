import { readFileSync } from "node:fs";
import { decodePngRgba } from "./art/toolkit/prop-source.mjs";

const [normalPath, disabledPath] = process.argv.slice(2);
if (!normalPath || !disabledPath) {
  throw new Error("usage: node scripts/assert-grounding-browser-render.mjs <normal.png> <grounding-off.png>");
}

const normal = decodePngRgba(readFileSync(normalPath));
const disabled = decodePngRgba(readFileSync(disabledPath));
if (normal.width !== disabled.width || normal.height !== disabled.height) {
  throw new Error(`browser grounding screenshots differ in size: ${normal.width}x${normal.height} vs ${disabled.width}x${disabled.height}`);
}

const luminance = (rgba, o) => 0.2126 * rgba[o] + 0.7152 * rgba[o + 1] + 0.0722 * rgba[o + 2];
const cards = Array.from({ length: 8 }, (_, index) => ({
  index,
  x: 16 + (index % 4) * 180,
  y: 16 + Math.floor(index / 4) * 180,
  w: 168,
  h: 168,
}));

let totalDarker = 0;
let totalDelta = 0;
for (const card of cards) {
  let darker = 0;
  let deltaSum = 0;
  for (let y = card.y; y < Math.min(normal.height, card.y + card.h); y += 1) {
    for (let x = card.x; x < Math.min(normal.width, card.x + card.w); x += 1) {
      const o = (y * normal.width + x) * 4;
      const delta = luminance(disabled.rgba, o) - luminance(normal.rgba, o);
      if (delta >= 2) {
        darker += 1;
        deltaSum += delta;
      }
    }
  }

  totalDarker += darker;
  totalDelta += deltaSum;
  console.log(`grounding browser QA dir-${card.index}: darkerPixels=${darker}, luminanceDelta=${deltaSum.toFixed(1)}`);

  if (darker < 18 || deltaSum < 70) {
    throw new Error(`dir-${card.index}: physical grounding is not visibly painted in the real browser render`);
  }
}

console.log(`grounding browser QA PASS: darkerPixels=${totalDarker}, luminanceDelta=${totalDelta.toFixed(1)}`);
