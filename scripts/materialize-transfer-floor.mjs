import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePngRgba, resizeLanczosPremultiplied } from "./art/toolkit/prop-source.mjs";
import { encodeRgbaPng } from "./art/toolkit/raster.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(
  root,
  "art-source/approved/area-01-transfer-ship/floor-treatment/source/transfer-floor-atlas-6x6__source-approved__2026-08-19.png",
);
const outputDir = join(root, "public/assets/deck/transfer-floor");

const EXPECTED_SOURCE_BYTES = 2_293_490;
const EXPECTED_SOURCE_SHA256 = "88a0cb598d4938ca767b1bde144e9737dfd520584eee61b02769a6d1845203bc";
const EXPECTED_SOURCE_SIZE = { width: 1254, height: 1254 };
const GRID = 6;
const RUNTIME_TILE = 64;

// The approved source is a deliberately cuttable 6x6 atlas. Image generation
// still introduced 1-2px drift in the black gutters, so a naive 1254/6 crop
// would bake dark separator pixels into the runtime floor. These coordinates
// select a common 196x196 square from the centre of each approved tile face.
// They are part of the approved-source extraction contract and must only change
// after source replacement + QA.
const PANEL_X = [11, 218, 425, 632, 840, 1047];
const PANEL_Y = [11, 217, 424, 631, 837, 1044];
const PANEL_SIZE = 196;

function cropRect(rgba, sourceWidth, x, y, width, height) {
  const out = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const srcStart = ((y + row) * sourceWidth + x) * 4;
    const dstStart = row * width * 4;
    out.set(rgba.subarray(srcStart, srcStart + width * 4), dstStart);
  }
  return out;
}

const source = readFileSync(sourcePath);
if (source.length !== EXPECTED_SOURCE_BYTES) {
  throw new Error(`Transfer Floor approved source byte mismatch: expected ${EXPECTED_SOURCE_BYTES}, got ${source.length}`);
}
const sourceSha = createHash("sha256").update(source).digest("hex");
if (sourceSha !== EXPECTED_SOURCE_SHA256) {
  throw new Error(`Transfer Floor approved source SHA-256 mismatch: ${sourceSha}`);
}

const decoded = decodePngRgba(source);
if (decoded.width !== EXPECTED_SOURCE_SIZE.width || decoded.height !== EXPECTED_SOURCE_SIZE.height) {
  throw new Error(`Transfer Floor approved source dimensions mismatch: ${decoded.width}x${decoded.height}`);
}
if (PANEL_X.length !== GRID || PANEL_Y.length !== GRID) {
  throw new Error(`Transfer Floor extraction contract must contain exactly ${GRID} columns and ${GRID} rows.`);
}
for (const x of PANEL_X) {
  if (x < 0 || x + PANEL_SIZE > decoded.width) throw new Error(`Transfer Floor panel x crop exceeds source: ${x}`);
}
for (const y of PANEL_Y) {
  if (y < 0 || y + PANEL_SIZE > decoded.height) throw new Error(`Transfer Floor panel y crop exceeds source: ${y}`);
}

mkdirSync(outputDir, { recursive: true });
const runtimeHashes = [];
for (let row = 0; row < GRID; row += 1) {
  for (let col = 0; col < GRID; col += 1) {
    const index = row * GRID + col;
    const cropped = cropRect(decoded.rgba, decoded.width, PANEL_X[col], PANEL_Y[row], PANEL_SIZE, PANEL_SIZE);
    const resized = resizeLanczosPremultiplied(cropped, PANEL_SIZE, PANEL_SIZE, RUNTIME_TILE, RUNTIME_TILE);
    const png = encodeRgbaPng({ width: RUNTIME_TILE, height: RUNTIME_TILE, rgba: resized });
    const filename = `transfer-floor-${String(index).padStart(2, "0")}.png`;
    writeFileSync(join(outputDir, filename), png);
    runtimeHashes.push(`${filename}:${createHash("sha256").update(png).digest("hex")}`);
  }
}

console.log(`Transfer Floor: validated approved source ${decoded.width}x${decoded.height} / ${sourceSha}`);
console.log(`Transfer Floor: extracted ${GRID}x${GRID} tile faces at ${PANEL_SIZE}x${PANEL_SIZE}, excluding generated gutters`);
console.log(`Transfer Floor: materialized ${runtimeHashes.length} deterministic ${RUNTIME_TILE}x${RUNTIME_TILE} runtime tiles`);
for (const value of runtimeHashes) console.log(`Transfer Floor: ${value}`);
