import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { preparePropPng } from "./art/toolkit/prop-source.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(
  root,
  "art-source/approved/area-01-transfer-ship/transfer-system/fx/yellow-core__approved-original__2026-08-17.png",
);
const outputPath = join(root, "public/assets/deck/yellow-core.png");

const EXPECTED_SOURCE_BYTES = 1_418_808;
const EXPECTED_SOURCE_SHA256 = "83f647900f0d5fba0dcd0c4f15ce9c705dbee90f4d9a12637129feeb9d64110d";
const EXPECTED_SOURCE_SIZE = { width: 1254, height: 1254 };
const EXPECTED_ALPHA_CROP = { x: 155, y: 116, w: 946, h: 968 };
const EXPECTED_CONTENT_BOUNDS = { x: 5, y: 4, w: 86, h: 88 };

function sameBounds(actual, expected) {
  return actual.x === expected.x
    && actual.y === expected.y
    && actual.w === expected.w
    && actual.h === expected.h;
}

const source = readFileSync(sourcePath);
if (source.length !== EXPECTED_SOURCE_BYTES) {
  throw new Error(`Yellow Core approved source byte mismatch: expected ${EXPECTED_SOURCE_BYTES}, got ${source.length}`);
}

const sourceSha = createHash("sha256").update(source).digest("hex");
if (sourceSha !== EXPECTED_SOURCE_SHA256) {
  throw new Error(`Yellow Core approved source SHA-256 mismatch: ${sourceSha}`);
}

if (source.length < 24 || source.toString("ascii", 1, 4) !== "PNG") {
  throw new Error("Yellow Core approved source is not a PNG.");
}
const sourceWidth = source.readUInt32BE(16);
const sourceHeight = source.readUInt32BE(20);
if (sourceWidth !== EXPECTED_SOURCE_SIZE.width || sourceHeight !== EXPECTED_SOURCE_SIZE.height) {
  throw new Error(`Yellow Core approved source dimensions mismatch: ${sourceWidth}x${sourceHeight}`);
}

// The Core is a transferable identity module, not a floor Prop. Keep a compact
// square runtime canvas so the same asset can later move between Apparatus and
// robot bodies without carrying placement/collision semantics with it.
const prepared = preparePropPng({
  bytes: source,
  targetWidth: 96,
  targetHeight: 96,
  margin: 4,
  alphaCutoff: 4,
  requireTransparency: true,
});

if (!sameBounds(prepared.sourceBounds, EXPECTED_ALPHA_CROP)) {
  throw new Error(`Yellow Core alpha crop drifted: ${JSON.stringify(prepared.sourceBounds)}`);
}
if (!sameBounds(prepared.contentBounds, EXPECTED_CONTENT_BOUNDS)) {
  throw new Error(`Yellow Core runtime content bounds drifted: ${JSON.stringify(prepared.contentBounds)}`);
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, prepared.png);

const runtimeSha = createHash("sha256").update(prepared.png).digest("hex");
console.log(`Yellow Core: validated approved source ${sourceWidth}x${sourceHeight}`);
console.log(`Yellow Core: alpha crop ${JSON.stringify(prepared.sourceBounds)}`);
console.log(`Yellow Core: runtime content ${JSON.stringify(prepared.contentBounds)} in 96x96 canvas`);
console.log(`Yellow Core: runtime SHA-256 ${runtimeSha}`);
console.log(`Yellow Core: wrote ${outputPath}`);
