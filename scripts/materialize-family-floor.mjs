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
const RUNTIME_TILE = 64;

// The approved image is a 3x3 presentation board, not a seamless 418px grid.
// Black gutters separate the nine actual floor panels. Mobile QA on 2026-08-18
// exposed the previous naive 1254/3 crop because those gutters became thick
// black seams at gameplay scale. These bounds select the panel faces only.
const PANEL_X = [20, 430, 840];
const PANEL_Y = [21, 430, 839];
const PANEL_WIDTH = 395;
const PANEL_HEIGHT = 394;

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

for (const x of PANEL_X) {
  if (x < 0 || x + PANEL_WIDTH > decoded.width) throw new Error(`Family Floor panel x crop exceeds source: ${x}`);
}
for (const y of PANEL_Y) {
  if (y < 0 || y + PANEL_HEIGHT > decoded.height) throw new Error(`Family Floor panel y crop exceeds source: ${y}`);
}

mkdirSync(outputDir, { recursive: true });
const runtimeHashes = [];
for (let row = 0; row < PANEL_Y.length; row += 1) {
  for (let col = 0; col < PANEL_X.length; col += 1) {
    const index = row * PANEL_X.length + col;
    const cropped = cropRect(
      decoded.rgba,
      decoded.width,
      PANEL_X[col],
      PANEL_Y[row],
      PANEL_WIDTH,
      PANEL_HEIGHT,
    );
    const resized = resizeLanczosPremultiplied(cropped, PANEL_WIDTH, PANEL_HEIGHT, RUNTIME_TILE, RUNTIME_TILE);
    const png = encodeRgbaPng({ width: RUNTIME_TILE, height: RUNTIME_TILE, rgba: resized });
    const filename = `family-floor-${String(index).padStart(2, "0")}.png`;
    writeFileSync(join(outputDir, filename), png);
    runtimeHashes.push(`${filename}:${createHash("sha256").update(png).digest("hex")}`);
  }
}

console.log(`Family Floor: validated approved source ${decoded.width}x${decoded.height}`);
console.log(`Family Floor: extracted 9 panel faces at ${PANEL_WIDTH}x${PANEL_HEIGHT}, excluding presentation-board gutters`);
console.log(`Family Floor: materialized ${runtimeHashes.length} deterministic ${RUNTIME_TILE}x${RUNTIME_TILE} runtime tiles`);
for (const value of runtimeHashes) console.log(`Family Floor: ${value}`);
