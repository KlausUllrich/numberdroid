import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePngRgba, resizeLanczosPremultiplied } from "./art/toolkit/prop-source.mjs";
import { encodeRgbaPng } from "./art/toolkit/raster.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(
  root,
  "art-source/approved/area-01-transfer-ship/floor-treatment/source/family-floor-3x3__source-approved__2026-08-18.png",
);
const outputDir = join(root, "public/assets/deck/family-floor");

const EXPECTED_SOURCE_BYTES = 2_378_807;
const EXPECTED_SOURCE_SHA256 = "ba50a566a31c846c52b739a73ed7911ff28f1335bf53bc745817b91344600468";
const EXPECTED_SOURCE_SIZE = { width: 1254, height: 1254 };
const SOURCE_GRID = 3;
const SOURCE_TILE = 418;
const RUNTIME_TILE = 64;

function cropSquare(rgba, sourceWidth, x, y, size) {
  const out = new Uint8Array(size * size * 4);
  for (let row = 0; row < size; row += 1) {
    const srcStart = ((y + row) * sourceWidth + x) * 4;
    const dstStart = row * size * 4;
    out.set(rgba.subarray(srcStart, srcStart + size * 4), dstStart);
  }
  return out;
}

const source = readFileSync(sourcePath);
if (source.length !== EXPECTED_SOURCE_BYTES) {
  throw new Error(`Family Floor approved source byte mismatch: expected ${EXPECTED_SOURCE_BYTES}, got ${source.length}`);
}
const sourceSha = createHash("sha256").update(source).digest("hex");
if (sourceSha !== EXPECTED_SOURCE_SHA256) {
  throw new Error(`Family Floor approved source SHA-256 mismatch: ${sourceSha}`);
}

const decoded = decodePngRgba(source);
if (decoded.width !== EXPECTED_SOURCE_SIZE.width || decoded.height !== EXPECTED_SOURCE_SIZE.height) {
  throw new Error(`Family Floor approved source dimensions mismatch: ${decoded.width}x${decoded.height}`);
}
if (decoded.width !== SOURCE_GRID * SOURCE_TILE || decoded.height !== SOURCE_GRID * SOURCE_TILE) {
  throw new Error("Family Floor approved source no longer divides into an exact 3x3 equal-cell grid.");
}

mkdirSync(outputDir, { recursive: true });
const runtimeHashes = [];
for (let row = 0; row < SOURCE_GRID; row += 1) {
  for (let col = 0; col < SOURCE_GRID; col += 1) {
    const index = row * SOURCE_GRID + col;
    const cropped = cropSquare(decoded.rgba, decoded.width, col * SOURCE_TILE, row * SOURCE_TILE, SOURCE_TILE);
    const resized = resizeLanczosPremultiplied(cropped, SOURCE_TILE, SOURCE_TILE, RUNTIME_TILE, RUNTIME_TILE);
    const png = encodeRgbaPng({ width: RUNTIME_TILE, height: RUNTIME_TILE, rgba: resized });
    const filename = `family-floor-${String(index).padStart(2, "0")}.png`;
    writeFileSync(join(outputDir, filename), png);
    runtimeHashes.push(`${filename}:${createHash("sha256").update(png).digest("hex")}`);
  }
}

console.log(`Family Floor: validated approved source ${decoded.width}x${decoded.height}`);
console.log(`Family Floor: exact 3x3 split into ${SOURCE_TILE}x${SOURCE_TILE} source cells`);
console.log(`Family Floor: materialized ${runtimeHashes.length} deterministic ${RUNTIME_TILE}x${RUNTIME_TILE} runtime tiles`);
for (const value of runtimeHashes) console.log(`Family Floor: ${value}`);
