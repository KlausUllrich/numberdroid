import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import { cropSupportedPng, decodeSupportedPng, encodeCanonicalRgbaPng, MAX_ATLAS_OUTPUT_PIXELS } from '../packages/preview/src/index.js';

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function chunk(type, data) {
  const name = Buffer.isBuffer(type) ? type : Buffer.from(type);
  const out = Buffer.alloc(data.length + 12); out.writeUInt32BE(data.length); name.copy(out, 4); data.copy(out, 8);
  let crc = 0xffffffff;
  for (const value of Buffer.concat([name, data])) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8); return out;
}
function header(width = 1, height = 1, { depth = 8, type = 3, interlace = 0 } = {}) {
  const value = Buffer.alloc(13); value.writeUInt32BE(width); value.writeUInt32BE(height, 4);
  value[8] = depth; value[9] = type; value[12] = interlace; return chunk('IHDR', value);
}
const end = () => chunk('IEND', Buffer.alloc(0));
const palette = Buffer.from([11, 22, 33, 44, 55, 66, 77, 88, 99]);
const png = (...chunks) => Buffer.concat([signature, ...chunks]);
function indexed({ width = 1, height = 1, colors = palette, alpha, raw = Buffer.from([0, 0]), ...options } = {}) {
  return png(header(width, height, options), chunk('PLTE', colors),
    ...(alpha === undefined ? [] : [chunk('tRNS', alpha)]), chunk('IDAT', deflateSync(raw)), end());
}
const invalid = value => assert.throws(() => decodeSupportedPng(value), error => error.code === 'ATLAS_PNG_INVALID');
const unsupported = value => assert.throws(() => decodeSupportedPng(value), error => error.code === 'ATLAS_PNG_UNSUPPORTED');
function filteredRows(rows, filter) {
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const choices = [a, b, c];
    return choices.reduce((best, value) => Math.abs(p - value) < Math.abs(p - best) ? value : best);
  };
  return Buffer.from(rows.flatMap((row, y) => [filter, ...row.map((value, x) => {
    const left = row[x - 1] ?? 0, up = rows[y - 1]?.[x] ?? 0, corner = rows[y - 1]?.[x - 1] ?? 0;
    const prediction = [0, left, up, Math.floor((left + up) / 2), paeth(left, up, corner)][filter];
    return (value - prediction + 256) & 255;
  })]));
}

test('indexed transparency preserves exact RGB including alpha zero and defaults absent entries to opaque', () => {
  const options = { width: 3, raw: Buffer.from([0, 0, 1, 2]) };
  assert.deepEqual([...decodeSupportedPng(indexed({ ...options, alpha: Buffer.from([0, 128]) })).rgba],
    [11, 22, 33, 0, 44, 55, 66, 128, 77, 88, 99, 255]);
  const opaque = [11, 22, 33, 255, 44, 55, 66, 255, 77, 88, 99, 255];
  assert.deepEqual([...decodeSupportedPng(indexed(options)).rgba], opaque);
  assert.deepEqual([...decodeSupportedPng(indexed({ ...options, alpha: Buffer.alloc(0) })).rgba], opaque);
});

test('all five filters reconstruct one-byte indexed pixels including index 255', () => {
  const colors = Buffer.from(Array.from({ length: 256 }, (_, index) => [index, 255 - index, (index * 13) & 255]).flat());
  const alpha = Buffer.from(Array.from({ length: 256 }, (_, index) => (index * 7) & 255));
  const rows = [[0, 255, 128, 1], [254, 0, 127, 255]];
  const expected = rows.flat().flatMap(index => [...colors.subarray(index * 3, index * 3 + 3), alpha[index]]);
  for (let filter = 0; filter <= 4; filter += 1) {
    const image = decodeSupportedPng(indexed({ width: 4, height: 2, colors, alpha, raw: filteredRows(rows, filter) }));
    assert.equal(image.width, 4); assert.equal(image.height, 2);
    assert.deepEqual([...image.rgba], expected, `filter ${filter}`);
  }
});

test('indexed crops have exact canonical parity with equivalent RGBA sources', () => {
  const rgba = Buffer.from([11, 22, 33, 0, 44, 55, 66, 128, 77, 88, 99, 255,
    77, 88, 99, 255, 44, 55, 66, 128, 11, 22, 33, 0]);
  const source = indexed({ width: 3, height: 2, alpha: Buffer.from([0, 128]), raw: Buffer.from([0, 0, 1, 2, 0, 2, 1, 0]) });
  const equivalent = encodeCanonicalRgbaPng({ width: 3, height: 2, rgba });
  const rectangles = [{ rectangleId: 'rect.indexed', x: 1, y: 0, width: 2, height: 2, included: true,
    pivot: null, transparentPaddingPolicy: 'preserve_exact_rect', replacesSliceId: null, expectedSliceVersion: null }];
  const crop = bytes => cropSupportedPng(bytes, rectangles, { expectedSource: {
    digest: createHash('sha256').update(bytes).digest('hex'), mediaType: 'image/png', width: 3, height: 2,
  } });
  const first = crop(source), second = crop(source), reference = crop(equivalent);
  assert.deepEqual(first.outputs[0].bytes, reference.outputs[0].bytes);
  assert.equal(first.outputs[0].digest, reference.outputs[0].digest);
  assert.equal(first.outputs[0].bytes[25], 6, 'Outputs stay canonical RGBA, never indexed');
  assert.deepEqual(encodeCanonicalRgbaPng(decodeSupportedPng(first.outputs[0].bytes)), first.outputs[0].bytes);
  assert.notDeepEqual(encodeCanonicalRgbaPng(decodeSupportedPng(source)), source,
    'Source acceptance does not make indexed encoding a canonical output');
  assert.deepEqual(second.outputs[0].bytes, first.outputs[0].bytes);
  assert.deepEqual([...decodeSupportedPng(first.outputs[0].bytes).rgba], [...rgba.subarray(4, 12), ...rgba.subarray(16, 24)]);
  assert.deepEqual([...source], [...indexed({ width: 3, height: 2, alpha: Buffer.from([0, 128]), raw: Buffer.from([0, 0, 1, 2, 0, 2, 1, 0]) })]);
});

test('existing RGB and RGBA inputs retain identical opaque pixel and canonical output behavior', () => {
  const rgba = Buffer.from([11, 22, 33, 255, 44, 55, 66, 255]);
  const rgb = png(header(2, 1, { type: 2 }), chunk('IDAT', deflateSync(Buffer.from([0, 11, 22, 33, 44, 55, 66]))), end());
  const canonical = encodeCanonicalRgbaPng({ width: 2, height: 1, rgba });
  for (const source of [rgb, canonical, indexed({ width: 2, raw: Buffer.from([0, 0, 1]) })]) {
    assert.deepEqual(decodeSupportedPng(source).rgba, rgba);
    assert.deepEqual(encodeCanonicalRgbaPng(decodeSupportedPng(source)), canonical);
  }
});

test('indexed palette shape, presence, duplication and pixel ranges fail closed', () => {
  for (const size of [0, 1, 4, 769, 771]) invalid(indexed({ colors: Buffer.alloc(size) }));
  const data = chunk('IDAT', deflateSync(Buffer.from([0, 0])));
  invalid(png(header(), data, end()));
  invalid(png(header(), chunk('PLTE', palette), chunk('PLTE', palette), data, end()));
  invalid(indexed({ colors: palette.subarray(0, 3), raw: Buffer.from([0, 1]) }));
});

test('palette and transparency must be ordered once before consecutive image data', () => {
  const plte = chunk('PLTE', palette), trns = chunk('tRNS', Buffer.from([0]));
  const data = chunk('IDAT', deflateSync(Buffer.from([0, 0])));
  for (const chunks of [
    [header(), trns, plte, data, end()],
    [header(), plte, trns, trns, data, end()],
    [header(), data, plte, end()],
    [header(), plte, data, plte, end()],
    [header(), plte, data, trns, end()],
    [plte, header(), data, end()],
    [header(), plte, data, chunk('tEXt', Buffer.from('a\0b')), chunk('IDAT', Buffer.alloc(0)), end()],
  ]) invalid(png(...chunks));
  invalid(indexed({ alpha: Buffer.from([1, 2, 3, 4]) }));
});

test('indexed PNG preserves CRC and raw chunk-name validation', () => {
  const damaged = indexed(); damaged[41] ^= 1; invalid(damaged);
  // Node ASCII decoding masks bit 7: this must not alias a real PLTE chunk.
  invalid(png(header(), chunk(Buffer.from([0xd0, 0x4c, 0x54, 0x45]), palette),
    chunk('IDAT', deflateSync(Buffer.from([0, 0]))), end()));
  unsupported(png(header(), chunk('ABCD', Buffer.alloc(0)), chunk('PLTE', palette),
    chunk('IDAT', deflateSync(Buffer.from([0, 0]))), end()));
});

test('indexed inflate length stays bounded and expanded RGBA is bounded before decoding', () => {
  invalid(indexed({ raw: Buffer.from([0]) }));
  invalid(indexed({ raw: Buffer.from([0, 0, 0]) }));
  invalid(indexed({ raw: Buffer.alloc(64 * 1024) }));
  const width = 8193, height = 8192;
  assert.ok(width * height * 4 > MAX_ATLAS_OUTPUT_PIXELS * 4);
  // Deliberately invalid zlib: a size rejection must precede inflate/allocation.
  const overLimit = png(header(width, height), chunk('PLTE', palette), chunk('IDAT', Buffer.from([0])), end());
  assert.throws(() => decodeSupportedPng(overLimit, { maxWidth: width, maxHeight: height }),
    error => error.code === 'ATLAS_PNG_UNSUPPORTED');
});

test('packed indexed depths, interlace and RGB transparency remain unsupported', () => {
  for (const depth of [1, 2, 4, 16]) unsupported(indexed({ depth }));
  unsupported(indexed({ interlace: 1 }));
  unsupported(png(header(1, 1, { type: 2 }), chunk('tRNS', Buffer.from([0, 11, 0, 22, 0, 33])),
    chunk('IDAT', deflateSync(Buffer.from([0, 11, 22, 33]))), end()));
});
