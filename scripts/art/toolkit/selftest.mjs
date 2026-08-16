import assert from "node:assert/strict";
import {
  alphaBounds,
  canonicalizeConnectorGroup,
  createMask,
  decodePngRgba,
  encodeRgbaPng,
  exposedBoundaryMask,
  meanConnectorDifference,
  preparePropPng,
  renderMaskedMaterial,
} from "./index.mjs";

const width = 32;
const height = 32;
const band = 12;
const mask = createMask(width, height, (_x, y) => y < band);
const connectors = [
  { side: "L", start: 0, end: band },
  { side: "R", start: 0, end: band },
];

const boundary = exposedBoundaryMask({ width, height, mask, connectors });
assert.equal(boundary[5 * width], 0, "left connector must not become an exposed edge");
assert.equal(boundary[0], 1, "top boundary remains exposed even at the corner");

const makeTile = (base) => renderMaskedMaterial({
  width,
  height,
  mask,
  connectors,
  materialSampler: (x, y) => [base + (x % 3), base + (y % 3), base + 4],
  outerDarkPx: 4,
}).rgba;

const tiles = [makeTile(48), makeTile(66), makeTile(84)];
const right0 = { tile: 0, side: "R", start: 0, end: band };
const left1 = { tile: 1, side: "L", start: 0, end: band };
const right1 = { tile: 1, side: "R", start: 0, end: band };
const left2 = { tile: 2, side: "L", start: 0, end: band };

const before = meanConnectorDifference({ width, height, tiles, a: right0, b: left1 });
assert(before > 0, "synthetic connector strips should differ before canonicalization");
canonicalizeConnectorGroup({ width, height, tiles, members: [right0, left1, right1, left2], blendPx: 5 });
const after01 = meanConnectorDifference({ width, height, tiles, a: right0, b: left1 });
const after12 = meanConnectorDifference({ width, height, tiles, a: right1, b: left2 });
assert.equal(after01, 0, "canonicalized connector pair 0/1 must be pixel-identical at boundary");
assert.equal(after12, 0, "canonicalized connector pair 1/2 must be pixel-identical at boundary");

const png = encodeRgbaPng({ width, height, rgba: tiles[0] });
assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Prop-source normalization proof: a compact opaque body with a deliberately
// tiny low-alpha halo must crop/fit into an exact transparent runtime canvas.
const sourceWidth = 32;
const sourceHeight = 24;
const sourceRgba = new Uint8Array(sourceWidth * sourceHeight * 4);
for (let y = 6; y < 18; y += 1) {
  for (let x = 8; x < 24; x += 1) {
    const o = (y * sourceWidth + x) * 4;
    sourceRgba[o] = 210;
    sourceRgba[o + 1] = 190;
    sourceRgba[o + 2] = 150;
    sourceRgba[o + 3] = 255;
  }
}
for (let x = 7; x <= 24; x += 1) {
  for (const y of [5, 18]) sourceRgba[(y * sourceWidth + x) * 4 + 3] = 3;
}
const sourcePng = encodeRgbaPng({ width: sourceWidth, height: sourceHeight, rgba: sourceRgba });
const prepared = preparePropPng({
  bytes: sourcePng,
  targetWidth: 20,
  targetHeight: 16,
  margin: 2,
  alphaCutoff: 4,
});
const decodedPrepared = decodePngRgba(prepared.png);
assert.equal(decodedPrepared.width, 20);
assert.equal(decodedPrepared.height, 16);
const preparedBounds = alphaBounds(decodedPrepared.rgba, 20, 16);
assert(preparedBounds, "prepared Prop must retain visible content");
assert(preparedBounds.x >= 1 && preparedBounds.y >= 1, "prepared Prop must retain transparent breathing room");
assert(preparedBounds.x + preparedBounds.w <= 19 && preparedBounds.y + preparedBounds.h <= 15, "prepared Prop must stay inside runtime canvas");
assert.equal(decodedPrepared.rgba[3], 0, "runtime canvas corner must remain transparent");
assert.deepEqual(prepared.sourceBounds, { x: 8, y: 6, w: 16, h: 12 }, "low-alpha halo must not expand the crop");

const opaque = new Uint8Array(4 * 4 * 4).fill(255);
const opaquePng = encodeRgbaPng({ width: 4, height: 4, rgba: opaque });
assert.throws(
  () => preparePropPng({ bytes: opaquePng, targetWidth: 8, targetHeight: 8 }),
  /no alpha transparency/i,
  "opaque backgrounds must not be mistaken for generic Freistellen",
);

console.log(`Art toolkit self-test PASS: connector diff ${before.toFixed(3)} -> ${after01.toFixed(3)}; Prop crop/fit ${prepared.sourceBounds.w}x${prepared.sourceBounds.h} -> ${prepared.contentBounds.w}x${prepared.contentBounds.h}`);
