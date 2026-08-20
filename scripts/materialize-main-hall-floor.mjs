import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePngRgba, resizeLanczosPremultiplied } from "./art/toolkit/prop-source.mjs";
import { encodeRgbaPng } from "./art/toolkit/raster.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(
  root,
  "art-source/approved/area-01-transfer-ship/floor-treatment/source/main-hall-floor-atlas-6x6__source-approved__2026-08-20.png",
);
const outputDir = join(root, "public/assets/deck/main-hall-floor");

const EXPECTED_SOURCE_BYTES = 2_847_955;
const EXPECTED_SOURCE_SHA256 = "bdf1fc2c4b6512b37c2bbd0702aa668a3bfb6e427212a8546953749f334d1914";
const EXPECTED_SOURCE_SIZE = { width: 1254, height: 1254 };
const RUNTIME_TILE = 64;

// The approved image targets a strict 6x6 grid, but the generated source still
// contains small 1-4 px pitch/gutter drift. These panel-face bounds were measured
// from the immutable approved source. Cropping faces rather than naive 1254/6
// cells prevents the light gutters from becoming visible seams in gameplay.
const PANEL_X = [
  { x: 18, width: 191 },
  { x: 224, width: 191 },
  { x: 428, width: 192 },
  { x: 633, width: 192 },
  { x: 839, width: 191 },
  { x: 1043, width: 192 },
];
const PANEL_Y = [
  { y: 17, height: 192 },
  { y: 223, height: 191 },
  { y: 428, height: 192 },
  { y: 635, height: 191 },
  { y: 841, height: 188 },
  { y: 1045, height: 189 },
];

// Live QA pass #2 showed that 12 px removed the bright outer wedges but still
// retained enough of the generated standalone-card border to create a noisy
// per-64px grid in gameplay. 24 px reaches the actual reusable material face:
// calm base tiles lose the decorative card frame while the calibrated traffic
// strip/junction geometry still reaches the runtime edges continuously.
const PRESENTATION_FRAME_INSET = 24;

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
  throw new Error(`Main Hall Floor approved source byte mismatch: expected ${EXPECTED_SOURCE_BYTES}, got ${source.length}`);
}
const sourceSha = createHash("sha256").update(source).digest("hex");
if (sourceSha !== EXPECTED_SOURCE_SHA256) {
  throw new Error(`Main Hall Floor approved source SHA-256 mismatch: ${sourceSha}`);
}

const decoded = decodePngRgba(source);
if (decoded.width !== EXPECTED_SOURCE_SIZE.width || decoded.height !== EXPECTED_SOURCE_SIZE.height) {
  throw new Error(`Main Hall Floor approved source dimensions mismatch: ${decoded.width}x${decoded.height}`);
}

for (const panel of PANEL_X) {
  if (panel.x < 0 || panel.x + panel.width > decoded.width) {
    throw new Error(`Main Hall Floor x crop exceeds source: ${JSON.stringify(panel)}`);
  }
  if (panel.width <= PRESENTATION_FRAME_INSET * 2) throw new Error("Main Hall Floor x panel too small for presentation-frame inset.");
}
for (const panel of PANEL_Y) {
  if (panel.y < 0 || panel.y + panel.height > decoded.height) {
    throw new Error(`Main Hall Floor y crop exceeds source: ${JSON.stringify(panel)}`);
  }
  if (panel.height <= PRESENTATION_FRAME_INSET * 2) throw new Error("Main Hall Floor y panel too small for presentation-frame inset.");
}

mkdirSync(outputDir, { recursive: true });
const runtimeHashes = [];
for (let row = 0; row < PANEL_Y.length; row += 1) {
  for (let col = 0; col < PANEL_X.length; col += 1) {
    const index = row * PANEL_X.length + col;
    const xPanel = PANEL_X[col];
    const yPanel = PANEL_Y[row];
    const cropped = cropRect(
      decoded.rgba,
      decoded.width,
      xPanel.x,
      yPanel.y,
      xPanel.width,
      yPanel.height,
    );

    const faceWidth = xPanel.width - PRESENTATION_FRAME_INSET * 2;
    const faceHeight = yPanel.height - PRESENTATION_FRAME_INSET * 2;
    const fullBleedFace = cropRect(
      cropped,
      xPanel.width,
      PRESENTATION_FRAME_INSET,
      PRESENTATION_FRAME_INSET,
      faceWidth,
      faceHeight,
    );
    const resized = resizeLanczosPremultiplied(
      fullBleedFace,
      faceWidth,
      faceHeight,
      RUNTIME_TILE,
      RUNTIME_TILE,
    );
    const png = encodeRgbaPng({ width: RUNTIME_TILE, height: RUNTIME_TILE, rgba: resized });
    const filename = `main-hall-floor-${String(index).padStart(2, "0")}.png`;
    writeFileSync(join(outputDir, filename), png);
    runtimeHashes.push(`${filename}:${createHash("sha256").update(png).digest("hex")}`);
  }
}

console.log(`Main Hall Floor: validated approved source ${decoded.width}x${decoded.height} / ${sourceSha}`);
console.log("Main Hall Floor: extracted 6x6 measured panel faces, excluding generated gutters");
console.log(`Main Hall Floor: removed ${PRESENTATION_FRAME_INSET}px source presentation frame on every side for full-bleed runtime faces`);
console.log(`Main Hall Floor: materialized ${runtimeHashes.length} deterministic ${RUNTIME_TILE}x${RUNTIME_TILE} runtime tiles`);
for (const value of runtimeHashes) console.log(`Main Hall Floor: ${value}`);
