import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { preparePropPng } from "./art/toolkit/prop-source.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(
  root,
  "art-source/approved/area-01-transfer-ship/transfer-system/source/transfer-apparatus__approved-original__2026-08-17.png",
);
const outputPath = join(root, "public/assets/deck/transfer-apparatus.png");

const EXPECTED_SOURCE_BYTES = 1_962_107;
const EXPECTED_SOURCE_SHA256 = "4adecec81c5e241a0952e0ed353836d6776f60960e9c8d1cf6e53727e402812c";
const EXPECTED_SOURCE_SIZE = { width: 1086, height: 1448 };
const EXPECTED_ALPHA_CROP = { x: 10, y: 0, w: 1065, h: 1448 };
// Approved Hero redesign keeps the proven 2×3 world scale while using much more
// of the canvas width. The wider silhouette restores visual importance without
// returning to the oversized 3×6 presentation.
const EXPECTED_CONTENT_BOUNDS = { x: 4, y: 14, w: 120, h: 163 };

function sameBounds(actual, expected) {
  return actual.x === expected.x
    && actual.y === expected.y
    && actual.w === expected.w
    && actual.h === expected.h;
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
  targetWidth: 128,
  targetHeight: 192,
  margin: 4,
  alphaCutoff: 4,
  requireTransparency: true,
});

if (!sameBounds(prepared.sourceBounds, EXPECTED_ALPHA_CROP)) {
  throw new Error(`Transfer Apparatus alpha crop drifted: ${JSON.stringify(prepared.sourceBounds)}`);
}
if (!sameBounds(prepared.contentBounds, EXPECTED_CONTENT_BOUNDS)) {
  throw new Error(`Transfer Apparatus runtime content bounds drifted: ${JSON.stringify(prepared.contentBounds)}`);
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, prepared.png);

const runtimeSha = createHash("sha256").update(prepared.png).digest("hex");
console.log(`Transfer Apparatus: validated approved source ${sourceWidth}x${sourceHeight}`);
console.log(`Transfer Apparatus: alpha crop ${JSON.stringify(prepared.sourceBounds)}`);
console.log(`Transfer Apparatus: runtime content ${JSON.stringify(prepared.contentBounds)} in 128x192 canvas`);
console.log(`Transfer Apparatus: runtime SHA-256 ${runtimeSha}`);
console.log(`Transfer Apparatus: wrote ${outputPath}`);
