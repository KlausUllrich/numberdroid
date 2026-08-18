import { readFileSync } from "node:fs";
import { decodePngRgba } from "./art/toolkit/prop-source.mjs";

const [normalPath, disabledPath] = process.argv.slice(2);
if (!normalPath || !disabledPath) {
  throw new Error("usage: node scripts/assert-grounding-real-scene.mjs <normal.png> <grounding-off.png>");
}

const normal = decodePngRgba(readFileSync(normalPath));
const disabled = decodePngRgba(readFileSync(disabledPath));
if (normal.width !== disabled.width || normal.height !== disabled.height) {
  throw new Error(`scene grounding screenshots differ in size: ${normal.width}x${normal.height} vs ${disabled.width}x${disabled.height}`);
}

const luminance = (rgba, o) => 0.2126 * rgba[o] + 0.7152 * rgba[o + 1] + 0.0722 * rgba[o + 2];
let darkerPixels = 0;
let luminanceDelta = 0;
let changedPixels = 0;

for (let y = 0; y < normal.height; y += 1) {
  for (let x = 0; x < normal.width; x += 1) {
    const o = (y * normal.width + x) * 4;
    const delta = luminance(disabled.rgba, o) - luminance(normal.rgba, o);
    const rgbDelta = Math.abs(disabled.rgba[o] - normal.rgba[o])
      + Math.abs(disabled.rgba[o + 1] - normal.rgba[o + 1])
      + Math.abs(disabled.rgba[o + 2] - normal.rgba[o + 2]);
    if (rgbDelta >= 3) changedPixels += 1;
    if (delta >= 2) {
      darkerPixels += 1;
      luminanceDelta += delta;
    }
  }
}

console.log(`grounding real-scene QA: changedPixels=${changedPixels}, darkerPixels=${darkerPixels}, luminanceDelta=${luminanceDelta.toFixed(1)}`);

/*
 * groundingScene=1 and groundingScene=1&groundingOff=1 share the exact same
 * paused MetaGame state. Therefore any meaningful visual difference must come
 * from the physical grounding DOM layer. These thresholds are intentionally
 * conservative: they catch a missing/fully-occluded shadow without prescribing
 * the final artistic intensity.
 */
if (darkerPixels < 24 || luminanceDelta < 350) {
  throw new Error("real TS-01 MetaGame render does not show enough visible physical grounding");
}

console.log("grounding real-scene QA PASS");
