import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { preparePropPng } from "./art/toolkit/prop-source.mjs";
import { encodeRgbaPng } from "./art/toolkit/raster.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(
  root,
  "art-source/approved/area-01-transfer-ship/transfer-system/source/transfer-apparatus__approved-original__2026-08-17.png",
);
const outputPath = join(root, "public/assets/deck/transfer-apparatus.png");
const shadowOutputPath = join(root, "public/assets/deck/transfer-apparatus-shadow.png");

const EXPECTED_SOURCE_BYTES = 1_962_107;
const EXPECTED_SOURCE_SHA256 = "4adecec81c5e241a0952e0ed353836d6776f60960e9c8d1cf6e53727e402812c";
const EXPECTED_SOURCE_SIZE = { width: 1086, height: 1448 };
const EXPECTED_ALPHA_CROP = { x: 10, y: 0, w: 1065, h: 1448 };
// Live QA approved the Hero redesign but found the 2×3 presentation too small.
// Keep the exact approved source and double only its runtime/world presentation
// to 4×6 tiles so the Transfer Room can visually center on the apparatus.
const EXPECTED_CONTENT_BOUNDS = { x: 8, y: 29, w: 240, h: 326 };

function sameBounds(actual, expected) {
  return actual.x === expected.x
    && actual.y === expected.y
    && actual.w === expected.w
    && actual.h === expected.h;
}

function boxBlurAlpha(input, width, height, radius) {
  const horizontal = new Float64Array(width * height);
  const output = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      const minX = Math.max(0, x - radius);
      const maxX = Math.min(width - 1, x + radius);
      for (let sx = minX; sx <= maxX; sx += 1) {
        sum += input[y * width + sx];
        count += 1;
      }
      horizontal[y * width + x] = sum / count;
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      const minY = Math.max(0, y - radius);
      const maxY = Math.min(height - 1, y + radius);
      for (let sy = minY; sy <= maxY; sy += 1) {
        sum += horizontal[sy * width + x];
        count += 1;
      }
      output[y * width + x] = Math.max(0, Math.min(255, Math.round(sum / count)));
    }
  }

  return output;
}

function createGroundingShadow(rgba, width, height) {
  const hardAlpha = new Uint8Array(width * height);
  for (let i = 0; i < hardAlpha.length; i += 1) {
    hardAlpha[i] = rgba[i * 4 + 3] >= 32 ? 255 : 0;
  }

  // Two modest box-blur passes approximate a soft top-down grounding shadow
  // without baking any lighting into the approved Hero source itself.
  const broad = boxBlurAlpha(hardAlpha, width, height, 5);
  const soft = boxBlurAlpha(broad, width, height, 3);
  const out = new Uint8Array(width * height * 4);
  const offsetX = 2;
  const offsetY = 6;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = x - offsetX;
      const sourceY = y - offsetY;
      if (sourceX < 0 || sourceX >= width || sourceY < 0 || sourceY >= height) continue;
      const sourceAlpha = soft[sourceY * width + sourceX];
      const alpha = Math.min(76, Math.round(sourceAlpha * 0.30));
      if (!alpha) continue;
      const o = (y * width + x) * 4;
      out[o] = 5;
      out[o + 1] = 8;
      out[o + 2] = 9;
      out[o + 3] = alpha;
    }
  }

  return encodeRgbaPng({ width, height, rgba: out });
}

const source = readFileSync(sourcePath);
if (source.length !== EXPECTED_SOURCE_BYTES) {
  throw new Error(`Transfer Apparatus approved source byte mismatch: expected ${EXPECTED_SOURCE_BYTES}, got ${source.length}`);
}

const sourceSha = createHash("sha256").update(source).digest("hex");
if (sourceSha !== EXPECTED_SOURCE_SHA256) {
  throw new Error(`Transfer Apparatus approved source SHA-256 mismatch: ${sourceSha}`);
}

if (source.length < 24 || source.toString("ascii", 1, 4) !== "PNG") {
  throw new Error("Transfer Apparatus approved source is not a PNG.");
}
const sourceWidth = source.readUInt32BE(16);
const sourceHeight = source.readUInt32BE(20);
if (sourceWidth !== EXPECTED_SOURCE_SIZE.width || sourceHeight !== EXPECTED_SOURCE_SIZE.height) {
  throw new Error(`Transfer Apparatus approved source dimensions mismatch: ${sourceWidth}x${sourceHeight}`);
}

const prepared = preparePropPng({
  bytes: source,
  targetWidth: 256,
  targetHeight: 384,
  margin: 8,
  alphaCutoff: 4,
  requireTransparency: true,
});

if (!sameBounds(prepared.sourceBounds, EXPECTED_ALPHA_CROP)) {
  throw new Error(`Transfer Apparatus alpha crop drifted: ${JSON.stringify(prepared.sourceBounds)}`);
}
if (!sameBounds(prepared.contentBounds, EXPECTED_CONTENT_BOUNDS)) {
  throw new Error(`Transfer Apparatus runtime content bounds drifted: ${JSON.stringify(prepared.contentBounds)}`);
}

const shadowPng = createGroundingShadow(prepared.rgba, 256, 384);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, prepared.png);
writeFileSync(shadowOutputPath, shadowPng);

const runtimeSha = createHash("sha256").update(prepared.png).digest("hex");
const shadowSha = createHash("sha256").update(shadowPng).digest("hex");
console.log(`Transfer Apparatus: validated approved source ${sourceWidth}x${sourceHeight}`);
console.log(`Transfer Apparatus: alpha crop ${JSON.stringify(prepared.sourceBounds)}`);
console.log(`Transfer Apparatus: runtime content ${JSON.stringify(prepared.contentBounds)} in 256x384 canvas`);
console.log(`Transfer Apparatus: runtime SHA-256 ${runtimeSha}`);
console.log(`Transfer Apparatus shadow: 256x384 FloorFX SHA-256 ${shadowSha}`);
console.log(`Transfer Apparatus: wrote ${outputPath}`);
console.log(`Transfer Apparatus shadow: wrote ${shadowOutputPath}`);
