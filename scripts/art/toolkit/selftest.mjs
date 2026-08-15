import assert from "node:assert/strict";
import {
  canonicalizeConnectorGroup,
  createMask,
  encodeRgbaPng,
  exposedBoundaryMask,
  meanConnectorDifference,
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

console.log(`Art toolkit self-test PASS: connector diff ${before.toFixed(3)} -> ${after01.toFixed(3)}`);
