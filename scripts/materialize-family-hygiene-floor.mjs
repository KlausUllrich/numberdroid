import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePngRgba, resizeLanczosPremultiplied } from "./art/toolkit/prop-source.mjs";
import { encodeRgbaPng } from "./art/toolkit/raster.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(
  root,
  "art-source/approved/area-01-transfer-ship/floor-treatment/source/family-hygiene-floor-2x2__source-approved__2026-08-21.png",
);
const outputDir = join(root, "public/assets/deck/family-hygiene-floor");

const EXPECTED_SOURCE_BYTES = 2_720_519;
const EXPECTED_SOURCE_SHA256 = "67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e";
const EXPECTED_SOURCE_SIZE = { width: 1254, height: 1254 };
const GRID = 2;
const RUNTIME_TILE = 64;

// The immutable source contains a 3-4 px neutral board gutter at the outer
// frame and between its four candidates. These measured 600x600 squares stay
// safely inside each material face, excluding separator antialiasing while
// retaining the full-scale isotropic texture approved in source and repeat QA.
const PANEL_X = [14, 640];
const PANEL_Y = [14, 639];
const PANEL_SIZE = 600;

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
  throw new Error(`Family Hygiene Floor approved source byte mismatch: expected ${EXPECTED_SOURCE_BYTES}, got ${source.length}`);
}
const sourceSha = createHash("sha256").update(source).digest("hex");
if (sourceSha !== EXPECTED_SOURCE_SHA256) {
  throw new Error(`Family Hygiene Floor approved source SHA-256 mismatch: ${sourceSha}`);
}

const decoded = decodePngRgba(source);
if (decoded.width !== EXPECTED_SOURCE_SIZE.width || decoded.height !== EXPECTED_SOURCE_SIZE.height) {
  throw new Error(`Family Hygiene Floor approved source dimensions mismatch: ${decoded.width}x${decoded.height}`);
}
if (PANEL_X.length !== GRID || PANEL_Y.length !== GRID) {
  throw new Error(`Family Hygiene Floor extraction contract must contain exactly ${GRID} columns and ${GRID} rows.`);
}
for (const x of PANEL_X) {
  if (x < 0 || x + PANEL_SIZE > decoded.width) throw new Error(`Family Hygiene Floor panel x crop exceeds source: ${x}`);
}
for (const y of PANEL_Y) {
  if (y < 0 || y + PANEL_SIZE > decoded.height) throw new Error(`Family Hygiene Floor panel y crop exceeds source: ${y}`);
}

mkdirSync(outputDir, { recursive: true });
const runtimeHashes = [];
for (let row = 0; row < GRID; row += 1) {
  for (let col = 0; col < GRID; col += 1) {
    const index = row * GRID + col;
    const cropped = cropRect(decoded.rgba, decoded.width, PANEL_X[col], PANEL_Y[row], PANEL_SIZE, PANEL_SIZE);
    const resized = resizeLanczosPremultiplied(cropped, PANEL_SIZE, PANEL_SIZE, RUNTIME_TILE, RUNTIME_TILE);
    const png = encodeRgbaPng({ width: RUNTIME_TILE, height: RUNTIME_TILE, rgba: resized });
    const filename = `family-hygiene-floor-${String(index).padStart(2, "0")}.png`;
    writeFileSync(join(outputDir, filename), png);
    runtimeHashes.push(`${filename}:${createHash("sha256").update(png).digest("hex")}`);
  }
}

console.log(`Family Hygiene Floor: validated approved source ${decoded.width}x${decoded.height} / ${sourceSha}`);
console.log(`Family Hygiene Floor: extracted ${GRID}x${GRID} measured ${PANEL_SIZE}x${PANEL_SIZE} material faces, excluding board gutters`);
console.log(`Family Hygiene Floor: materialized ${runtimeHashes.length} deterministic ${RUNTIME_TILE}x${RUNTIME_TILE} runtime tiles`);
for (const value of runtimeHashes) console.log(`Family Hygiene Floor: ${value}`);
