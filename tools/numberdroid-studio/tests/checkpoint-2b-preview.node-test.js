import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { deflateSync, inflateSync } from 'node:zlib';
import {
  canonicalRgbaPngByteSize,
  cropSupportedPng,
  decodeSupportedPng,
  proposeRegularGrid,
  validateAtlasRectangles,
} from '../packages/preview/src/index.js';

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[n] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function independentChunk(type, data) {
  const name = Buffer.from(type); const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); name.copy(out, 4); data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8); return out;
}

function independentPng(width, height, rgba) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) Buffer.from(rgba).copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), independentChunk('IHDR', header), independentChunk('IDAT', deflateSync(raw)), independentChunk('IEND', Buffer.alloc(0))]);
}

function sourceDescriptor(bytes, width, height) {
  return { digest: createHash('sha256').update(bytes).digest('hex'), mediaType: 'image/png', width, height };
}

function crop(bytes, rectangles, width, height) {
  return cropSupportedPng(bytes, rectangles, { expectedSource: sourceDescriptor(bytes, width, height) });
}

function canonicalRawScanlines(png) {
  let offset = 8;
  const idat = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') idat.push(png.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  return inflateSync(Buffer.concat(idat));
}

const baseRect = (overrides = {}) => ({
  rectangleId: 'rect.oracle', x: 0, y: 0, width: 1, height: 1, included: true,
  pivot: null, transparentPaddingPolicy: 'preserve_exact_rect', replacesSliceId: null,
  expectedSliceVersion: null, ...overrides,
});

test('Family Hygiene arithmetic proposal is the measured 3px margin / 4px gap contract', () => {
  const proposal = proposeRegularGrid({
    sourceWidth: 1254, sourceHeight: 1254, rows: 2, columns: 2,
    margins: { top: 3, right: 3, bottom: 3, left: 3 }, gapX: 4, gapY: 4,
    rectangleIdPrefix: 'rect.family-hygiene',
  });
  assert.equal(proposal.authoritative, false);
  assert.deepEqual(proposal.rectangles.map(({ x, y, width, height }) => ({ x, y, width, height })), [
    { x: 3, y: 3, width: 622, height: 622 },
    { x: 629, y: 3, width: 622, height: 622 },
    { x: 3, y: 629, width: 622, height: 622 },
    { x: 629, y: 629, width: 622, height: 622 },
  ]);
});

test('regular-grid remainder is a visible proposal finding, never rounded authority', () => {
  const proposal = proposeRegularGrid({
    sourceWidth: 10, sourceHeight: 10, rows: 2, columns: 3,
    margins: { top: 0, right: 0, bottom: 0, left: 0 }, gapX: 0, gapY: 0,
  });
  assert.equal(proposal.rectangles.length, 0);
  assert.equal(proposal.findings[0].code, 'studio.atlas.grid.width_remainder');
});

test('rectangle contract rejects bounds overflow, duplicates, overlap, unsafe numbers, and ambiguous remaps', () => {
  const validate = (rectangles) => validateAtlasRectangles(rectangles, { sourceWidth: 8, sourceHeight: 8 });
  assert.throws(() => validate([baseRect({ x: 8 })]), (error) => error.code === 'ATLAS_RECT_OUT_OF_BOUNDS');
  assert.throws(() => validate([baseRect({ width: 0 })]), (error) => error.code === 'ATLAS_RECT_INVALID');
  assert.throws(() => validate([baseRect({ x: Number.MAX_SAFE_INTEGER })]), (error) => error.code === 'ATLAS_RECT_OUT_OF_BOUNDS');
  assert.throws(() => validate([baseRect(), baseRect()]), (error) => error.code === 'ATLAS_RECT_DUPLICATE_ID');
  assert.throws(() => validate([baseRect(), baseRect({ rectangleId: 'rect.two' })]), (error) => error.code === 'ATLAS_RECT_DUPLICATE');
  assert.throws(() => validate([baseRect({ width: 3 }), baseRect({ rectangleId: 'rect.two', x: 2, width: 2 })]), (error) => error.code === 'ATLAS_RECT_OVERLAP');
  assert.throws(() => validate([
    baseRect({ replacesSliceId: 'slice.old', expectedSliceVersion: 1 }),
    baseRect({ rectangleId: 'rect.two', x: 2, replacesSliceId: 'slice.old', expectedSliceVersion: 1 }),
  ]), (error) => error.code === 'ATLAS_REMAP_NOT_ONE_TO_ONE');
  assert.throws(() => validate([baseRect({ included: false, replacesSliceId: 'slice.old', expectedSliceVersion: 1 })]), (error) => error.code === 'ATLAS_REMAP_INVALID');
  assert.throws(() => validateAtlasRectangles([
    baseRect({ width: 4096, height: 4096 }),
  ], { sourceWidth: 4096, sourceHeight: 4096 }), (error) => error.code === 'ATLAS_OUTPUT_BYTES_LIMIT');
  assert.doesNotThrow(() => validate([baseRect({ width: 2 }), baseRect({ rectangleId: 'rect.two', x: 2, width: 2 })]));
  assert.equal(canonicalRgbaPngByteSize(622, 622), 1_548_341);
});

test('tiny independent pixel oracle proves exact top-left, interior, one-pixel, and bottom-right crops', () => {
  const width = 4; const height = 3; const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const offset = (y * width + x) * 4;
    rgba[offset] = x * 40 + 3; rgba[offset + 1] = y * 70 + 5; rgba[offset + 2] = x + y * 10; rgba[offset + 3] = 100 + x + y;
  }
  const source = independentPng(width, height, rgba);
  const result = crop(source, [
    baseRect({ rectangleId: 'rect.top-left' }),
    baseRect({ rectangleId: 'rect.interior', x: 1, y: 1, width: 2, height: 2 }),
    baseRect({ rectangleId: 'rect.bottom-right', x: 3, y: 2 }),
  ], width, height);
  const decoded = result.outputs.map((output) => decodeSupportedPng(output.bytes));
  assert.deepEqual([...decoded[0].rgba], [...rgba.subarray(0, 4)]);
  assert.deepEqual([...decoded[1].rgba], [
    ...rgba.subarray((1 * width + 1) * 4, (1 * width + 3) * 4),
    ...rgba.subarray((2 * width + 1) * 4, (2 * width + 3) * 4),
  ]);
  assert.deepEqual([...decoded[2].rgba], [...rgba.subarray((2 * width + 3) * 4, (2 * width + 4) * 4)]);
  assert.equal(result.outputs[2].width, 1); assert.equal(result.outputs[2].height, 1);
  assert.equal(result.outputs[2].digest, createHash('sha256').update(result.outputs[2].bytes).digest('hex'));
  assert.deepEqual([...canonicalRawScanlines(result.outputs[1].bytes)], [
    0, ...rgba.subarray((1 * width + 1) * 4, (1 * width + 3) * 4),
    0, ...rgba.subarray((2 * width + 1) * 4, (2 * width + 3) * 4),
  ]);
});

test('audited cutter fails closed for WebP, palette PNG, CRC corruption, and right/bottom +1', () => {
  const webp = Buffer.from('RIFFxxxxWEBP', 'ascii');
  assert.throws(() => cropSupportedPng(webp, [baseRect()], { expectedSource: { digest: createHash('sha256').update(webp).digest('hex'), mediaType: 'image/png', width: 1, height: 1 } }), (error) => error.code === 'ATLAS_PNG_INVALID');
  const source = independentPng(2, 2, Buffer.alloc(16, 255));
  const paletteHeader = Buffer.alloc(13); paletteHeader.writeUInt32BE(1, 0); paletteHeader.writeUInt32BE(1, 4); paletteHeader[8] = 8; paletteHeader[9] = 3;
  const palette = Buffer.concat([source.subarray(0, 8), independentChunk('IHDR', paletteHeader), independentChunk('IDAT', deflateSync(Buffer.from([0, 0]))), independentChunk('IEND', Buffer.alloc(0))]);
  assert.throws(() => decodeSupportedPng(palette), (error) => error.code === 'ATLAS_PNG_UNSUPPORTED');
  const rgbHeader = Buffer.alloc(13); rgbHeader.writeUInt32BE(1, 0); rgbHeader.writeUInt32BE(1, 4); rgbHeader[8] = 8; rgbHeader[9] = 2;
  const rgbTransparency = Buffer.concat([
    source.subarray(0, 8), independentChunk('IHDR', rgbHeader), independentChunk('tRNS', Buffer.from([0, 1, 0, 2, 0, 3])),
    independentChunk('IDAT', deflateSync(Buffer.from([0, 1, 2, 3]))), independentChunk('IEND', Buffer.alloc(0)),
  ]);
  assert.throws(() => decodeSupportedPng(rgbTransparency), (error) => error.code === 'ATLAS_PNG_UNSUPPORTED');
  const corrupt = Buffer.from(source); corrupt[corrupt.length - 5] ^= 1;
  assert.throws(() => decodeSupportedPng(corrupt), (error) => error.code === 'ATLAS_PNG_INVALID');
  assert.throws(() => crop(source, [baseRect({ x: 1, width: 2 })], 2, 2), (error) => error.code === 'ATLAS_RECT_OUT_OF_BOUNDS');
  assert.throws(() => crop(source, [baseRect({ y: 1, height: 2 })], 2, 2), (error) => error.code === 'ATLAS_RECT_OUT_OF_BOUNDS');
});

test('PNG structure, compressed input, and approved source identity fail closed', () => {
  const rgba = Buffer.from([1, 2, 3, 4]);
  const valid = independentPng(1, 1, rgba);
  const header = Buffer.alloc(13); header.writeUInt32BE(1, 0); header.writeUInt32BE(1, 4); header[8] = 8; header[9] = 6;
  const raw = Buffer.from([0, ...rgba]);
  const reordered = Buffer.concat([
    valid.subarray(0, 8), independentChunk('IDAT', deflateSync(raw)),
    independentChunk('IHDR', header), independentChunk('IEND', Buffer.alloc(0)),
  ]);
  assert.throws(() => decodeSupportedPng(reordered), (error) => error.code === 'ATLAS_PNG_INVALID');
  const split = Buffer.concat([
    valid.subarray(0, 8), independentChunk('IHDR', header), independentChunk('IDAT', deflateSync(raw)),
    independentChunk('tEXt', Buffer.from('a\0b')), independentChunk('IDAT', Buffer.alloc(0)), independentChunk('IEND', Buffer.alloc(0)),
  ]);
  assert.throws(() => decodeSupportedPng(split), (error) => error.code === 'ATLAS_PNG_INVALID');
  assert.throws(() => decodeSupportedPng(valid, { maxInputBytes: valid.length - 1 }), (error) => error.code === 'ATLAS_PNG_UNSUPPORTED');
  const different = independentPng(1, 1, Buffer.from([5, 6, 7, 8]));
  assert.throws(() => cropSupportedPng(different, [baseRect()], { expectedSource: sourceDescriptor(valid, 1, 1) }), (error) => error.code === 'ATLAS_SOURCE_MISMATCH');
});

test('real Family Hygiene crops are source-resolution, deterministic, and pinned', async () => {
  const source = await readFile('../../art-source/approved/area-01-transfer-ship/floor-treatment/source/family-hygiene-floor-2x2__source-approved__2026-08-21.png');
  assert.equal(createHash('sha256').update(source).digest('hex'), '67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e');
  const proposal = proposeRegularGrid({
    sourceWidth: 1254, sourceHeight: 1254, rows: 2, columns: 2,
    margins: { top: 3, right: 3, bottom: 3, left: 3 }, gapX: 4, gapY: 4,
    rectangleIdPrefix: 'rect.family-hygiene',
  });
  const first = crop(source, proposal.rectangles, 1254, 1254);
  const second = crop(source, proposal.rectangles, 1254, 1254);
  assert.deepEqual(first.outputs.map((output) => [output.width, output.height, output.byteSize, output.digest]), [
    [622, 622, 1548341, 'ef83efbee4b00ec49679f0409ba6f33423729b9d67946ba45f3ab119a91886f2'],
    [622, 622, 1548341, '3781086c30598cf8c07582f9b830e3343e0e1363f2e7c17d35a6678eeeb41c7e'],
    [622, 622, 1548341, '9d4c867156c590d372c9c7ef955596c919d717821b65ea992db0e7606cde2526'],
    [622, 622, 1548341, 'a63dceb520a894a3e91e547d93e15d154873f04bb32e0ac8f8354ca7d2150318'],
  ]);
  assert.deepEqual(second.outputs.map((output) => output.bytes), first.outputs.map((output) => output.bytes));
});
