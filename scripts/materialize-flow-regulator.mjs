import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { preparePropPng } from "./art/toolkit/prop-source.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(
  root,
  "art-source/approved/area-01-transfer-ship/transfer-system/source/flow-regulator__approved-original__2026-08-17.png",
);
const outputPath = join(root, "public/assets/deck/flow-regulator.png");

const EXPECTED_SOURCE_BYTES = 2_143_729;
const EXPECTED_SOURCE_SHA256 = "e4ed4130e7a1c615986f2011237c78ddd5a4bb51c7e041586327e8c5be992f1e";
const EXPECTED_SOURCE_SIZE = { width: 1254, height: 1254 };
const EXPECTED_ALPHA_CROP = { x: 49, y: 45, w: 1156, h: 1164 };
const EXPECTED_CONTENT_BOUNDS = { x: 8, y: 8, w: 111, h: 112 };

function sameBounds(actual, expected) {
  return actual.x === expected.x
    && actual.y === expected.y
    && actual.w === expected.w
    && actual.h === expected.h;
}

const source = readFileSync(sourcePath);
if (source.length !== EXPECTED_SOURCE_BYTES) {
  throw new Error(`Flow Regulator approved source byte mismatch: expected ${EXPECTED_SOURCE_BYTES}, got ${source.length}`);
}

const sourceSha = createHash("sha256").update(source).digest("hex");
if (sourceSha !== EXPECTED_SOURCE_SHA256) {
  throw new Error(`Flow Regulator approved source SHA-256 mismatch: ${sourceSha}`);
}

if (source.length < 24 || source.toString("ascii", 1, 4) !== "PNG") {
  throw new Error("Flow Regulator approved source is not a PNG.");
}
const sourceWidth = source.readUInt32BE(16);
const sourceHeight = source.readUInt32BE(20);
if (sourceWidth !== EXPECTED_SOURCE_SIZE.width || sourceHeight !== EXPECTED_SOURCE_SIZE.height) {
  throw new Error(`Flow Regulator approved source dimensions mismatch: ${sourceWidth}x${sourceHeight}`);
}

// Keep the existing 2x2 semantic/solver reservation while fitting the visible
// support machine inside that canvas. Live QA decides whether this apparent
// scale is accepted before shadow/collision/FloorFX are finalized.
const prepared = preparePropPng({
  bytes: source,
  targetWidth: 128,
  targetHeight: 128,
  margin: 8,
  alphaCutoff: 4,
  requireTransparency: true,
});

if (!sameBounds(prepared.sourceBounds, EXPECTED_ALPHA_CROP)) {
  throw new Error(`Flow Regulator alpha crop drifted: ${JSON.stringify(prepared.sourceBounds)}`);
}
if (!sameBounds(prepared.contentBounds, EXPECTED_CONTENT_BOUNDS)) {
  throw new Error(`Flow Regulator runtime content bounds drifted: ${JSON.stringify(prepared.contentBounds)}`);
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, prepared.png);

const runtimeSha = createHash("sha256").update(prepared.png).digest("hex");
console.log(`Flow Regulator: validated approved source ${sourceWidth}x${sourceHeight}`);
console.log(`Flow Regulator: alpha crop ${JSON.stringify(prepared.sourceBounds)}`);
console.log(`Flow Regulator: runtime content ${JSON.stringify(prepared.contentBounds)} in 128x128 canvas`);
console.log(`Flow Regulator: runtime SHA-256 ${runtimeSha}`);
console.log(`Flow Regulator: wrote ${outputPath}`);
