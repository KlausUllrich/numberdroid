import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import {
  ATLAS_PROCESSOR_ID,
  MAX_ATLAS_OUTPUT_BYTES,
  MAX_ATLAS_OUTPUT_PIXELS,
  canonicalRgbaPngByteSize,
  proposeRegularGrid,
  validateAtlasRectangles,
} from '../../domain/src/atlas-definition.js';
import { invariant } from '../../domain/src/errors.js';

export {
  ATLAS_PROCESSOR_ID,
  MAX_ATLAS_OUTPUT_BYTES,
  MAX_ATLAS_OUTPUT_PIXELS,
  MAX_ATLAS_RECTANGLES,
  TRANSPARENT_PADDING_POLICY,
  canonicalRgbaPngByteSize,
  proposeRegularGrid,
  validateAtlasRectangles,
} from '../../domain/src/atlas-definition.js';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const DEFAULT_MAX_INPUT_BYTES = 16 * 1024 * 1024;
function safeInteger(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  invariant(Number.isSafeInteger(value) && value >= min && value <= max, 'ATLAS_RECT_INVALID', `${field} must be a safe integer from ${min} to ${max}.`, { field });
  return value;
}

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

function pngChunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  name.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return output;
}

function adler32(bytes) {
  let a = 1;
  let b = 0;
  for (let offset = 0; offset < bytes.length; offset += 5552) {
    const end = Math.min(offset + 5552, bytes.length);
    for (let index = offset; index < end; index += 1) {
      a += bytes[index];
      b += a;
    }
    a %= 65521;
    b %= 65521;
  }
  return ((b << 16) | a) >>> 0;
}

// Processor-owned zlib stream: RFC 1950 wrapper with RFC 1951 stored blocks.
// It trades compression ratio for a byte stream that does not change with a
// native zlib implementation or compression heuristic.
function encodeStoredZlib(bytes) {
  const blocks = [];
  for (let offset = 0; offset < bytes.length; offset += 65535) {
    const length = Math.min(65535, bytes.length - offset);
    const block = Buffer.alloc(5 + length);
    block[0] = offset + length === bytes.length ? 1 : 0;
    block.writeUInt16LE(length, 1);
    block.writeUInt16LE(0xffff ^ length, 3);
    bytes.copy(block, 5, offset, offset + length);
    blocks.push(block);
  }
  const trailer = Buffer.alloc(4);
  trailer.writeUInt32BE(adler32(bytes));
  return Buffer.concat([Buffer.from([0x78, 0x01]), ...blocks, trailer]);
}

function unfilterScanlines(raw, width, height, bytesPerPixel) {
  const stride = width * bytesPerPixel;
  invariant(raw.length === height * (stride + 1), 'ATLAS_PNG_INVALID', 'PNG inflated byte count does not match its dimensions.');
  const output = Buffer.alloc(height * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
  };
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const sourceStart = y * (stride + 1) + 1;
    const rowStart = y * stride;
    const priorStart = (y - 1) * stride;
    for (let x = 0; x < stride; x += 1) {
      const encoded = raw[sourceStart + x];
      const left = x >= bytesPerPixel ? output[rowStart + x - bytesPerPixel] : 0;
      const up = y > 0 ? output[priorStart + x] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? output[priorStart + x - bytesPerPixel] : 0;
      let decoded;
      if (filter === 0) decoded = encoded;
      else if (filter === 1) decoded = (encoded + left) & 255;
      else if (filter === 2) decoded = (encoded + up) & 255;
      else if (filter === 3) decoded = (encoded + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) decoded = (encoded + paeth(left, up, upLeft)) & 255;
      else invariant(false, 'ATLAS_PNG_UNSUPPORTED', `PNG filter ${filter} is unsupported.`);
      output[rowStart + x] = decoded;
    }
  }
  return output;
}

export function decodeSupportedPng(bytes, {
  maxWidth = 4096,
  maxHeight = 4096,
  maxInputBytes = DEFAULT_MAX_INPUT_BYTES,
} = {}) {
  invariant(Buffer.isBuffer(bytes) || bytes instanceof Uint8Array, 'ATLAS_PNG_INVALID', 'PNG input must be a byte buffer.');
  safeInteger(maxInputBytes, 'maxInputBytes', { min: 33 });
  const input = Buffer.from(bytes);
  invariant(input.length <= maxInputBytes, 'ATLAS_PNG_UNSUPPORTED', 'PNG input exceeds the audited cutter byte limit.', { maxInputBytes });
  invariant(input.length >= 33 && input.subarray(0, 8).equals(PNG_SIGNATURE), 'ATLAS_PNG_INVALID', 'Atlas source is not a PNG file.');
  let offset = 8;
  let ihdr = null;
  const idat = [];
  let idatEnded = false;
  let sawEnd = false;
  let chunkIndex = 0;
  while (offset + 12 <= input.length) {
    const length = input.readUInt32BE(offset);
    const type = input.toString('ascii', offset + 4, offset + 8);
    invariant(/^[A-Za-z]{4}$/.test(type) && /[A-Z]/.test(type[2]), 'ATLAS_PNG_INVALID', 'PNG chunk type is structurally invalid.');
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    invariant(Number.isSafeInteger(dataEnd) && dataEnd + 4 <= input.length, 'ATLAS_PNG_INVALID', `PNG chunk ${type} exceeds file bounds.`);
    const data = input.subarray(dataStart, dataEnd);
    const expectedCrc = input.readUInt32BE(dataEnd);
    invariant(crc32(input.subarray(offset + 4, dataEnd)) === expectedCrc, 'ATLAS_PNG_INVALID', `PNG chunk ${type} failed CRC validation.`);
    if (type === 'IHDR') {
      invariant(chunkIndex === 0 && ihdr === null && length === 13, 'ATLAS_PNG_INVALID', 'PNG requires one valid first IHDR chunk.');
      ihdr = Buffer.from(data);
    } else if (type === 'IDAT') {
      invariant(ihdr !== null && !idatEnded, 'ATLAS_PNG_INVALID', 'PNG IDAT chunks must follow IHDR and be consecutive.');
      idat.push(Buffer.from(data));
    } else if (type === 'IEND') {
      invariant(ihdr !== null && idat.length > 0 && length === 0, 'ATLAS_PNG_INVALID', 'PNG IEND must follow image data and be empty.');
      sawEnd = true; offset = dataEnd + 4; break;
    }
    else if (type === 'tRNS') invariant(false, 'ATLAS_PNG_UNSUPPORTED', 'PNG tRNS transparency is outside the audited RGB/RGBA cutter subset.');
    else if ((type.charCodeAt(0) & 0x20) === 0) invariant(false, 'ATLAS_PNG_UNSUPPORTED', `Unsupported critical PNG chunk ${type}.`);
    else if (idat.length > 0) idatEnded = true;
    offset = dataEnd + 4;
    chunkIndex += 1;
  }
  invariant(ihdr && idat.length > 0 && sawEnd && offset === input.length, 'ATLAS_PNG_INVALID', 'PNG is incomplete or contains trailing bytes.');
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  invariant(width > 0 && height > 0 && width <= maxWidth && height <= maxHeight, 'ATLAS_PNG_UNSUPPORTED', 'PNG dimensions exceed the audited cutter bounds.', { width, height, maxWidth, maxHeight });
  invariant(bitDepth === 8 && (colorType === 2 || colorType === 6), 'ATLAS_PNG_UNSUPPORTED', 'Checkpoint 2B cuts only non-interlaced 8-bit RGB or RGBA PNG sources.', { bitDepth, colorType });
  invariant(ihdr[10] === 0 && ihdr[11] === 0 && ihdr[12] === 0, 'ATLAS_PNG_UNSUPPORTED', 'PNG compression, filter method, or interlace mode is unsupported.');
  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const expectedInflated = height * (width * bytesPerPixel + 1);
  invariant(Number.isSafeInteger(expectedInflated) && expectedInflated <= MAX_ATLAS_OUTPUT_PIXELS * 4 + maxHeight, 'ATLAS_PNG_UNSUPPORTED', 'PNG decoded size exceeds the audited cutter bound.');
  let inflated;
  try {
    inflated = inflateSync(Buffer.concat(idat), { maxOutputLength: expectedInflated });
  } catch {
    invariant(false, 'ATLAS_PNG_INVALID', 'PNG compressed data could not be decoded safely.');
  }
  const scanlines = unfilterScanlines(inflated, width, height, bytesPerPixel);
  const rgba = Buffer.alloc(width * height * 4);
  for (let source = 0, target = 0; source < scanlines.length; source += bytesPerPixel, target += 4) {
    rgba[target] = scanlines[source];
    rgba[target + 1] = scanlines[source + 1];
    rgba[target + 2] = scanlines[source + 2];
    rgba[target + 3] = colorType === 6 ? scanlines[source + 3] : 255;
  }
  return Object.freeze({ width, height, rgba });
}

export function encodeCanonicalRgbaPng({ width, height, rgba }) {
  safeInteger(width, 'width', { min: 1 });
  safeInteger(height, 'height', { min: 1 });
  const pixels = Buffer.isBuffer(rgba) ? rgba : Buffer.from(rgba);
  invariant(pixels.length === width * height * 4, 'ATLAS_PNG_INVALID', 'RGBA byte count does not match output dimensions.');
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 6; header[10] = 0; header[11] = 0; header[12] = 0;
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const encoded = Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', header),
    pngChunk('IDAT', encodeStoredZlib(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  invariant(encoded.length === canonicalRgbaPngByteSize(width, height), 'ATLAS_PNG_INVALID', 'Canonical PNG encoder length differs from its bounded processor contract.');
  invariant(encoded.length <= MAX_ATLAS_OUTPUT_BYTES, 'ATLAS_OUTPUT_BYTES_LIMIT', 'Canonical PNG exceeds the per-artifact byte limit.', {
    byteSize: encoded.length,
    maxOutputBytes: MAX_ATLAS_OUTPUT_BYTES,
  });
  return encoded;
}

export function cropSupportedPng(bytes, rectangles, { expectedSource } = {}) {
  invariant(expectedSource && typeof expectedSource === 'object' && !Array.isArray(expectedSource), 'ATLAS_SOURCE_REQUIRED', 'An immutable expected source descriptor is required.');
  invariant(expectedSource.mediaType === 'image/png', 'ATLAS_PNG_UNSUPPORTED', 'Checkpoint 2B cuts only approved PNG sources.');
  invariant(typeof expectedSource.digest === 'string' && /^[a-f0-9]{64}$/.test(expectedSource.digest), 'ATLAS_SOURCE_REQUIRED', 'Expected source digest must be lowercase SHA-256 hex.');
  safeInteger(expectedSource.width, 'expectedSource.width', { min: 1 });
  safeInteger(expectedSource.height, 'expectedSource.height', { min: 1 });
  const sourceDigest = createHash('sha256').update(bytes).digest('hex');
  invariant(sourceDigest === expectedSource.digest, 'ATLAS_SOURCE_MISMATCH', 'Resolved source bytes do not match the approved source digest.', { expectedDigest: expectedSource.digest, actualDigest: sourceDigest });
  const source = decodeSupportedPng(bytes);
  invariant(source.width === expectedSource.width && source.height === expectedSource.height, 'ATLAS_SOURCE_MISMATCH', 'Resolved source dimensions do not match the approved source descriptor.', { expectedWidth: expectedSource.width, expectedHeight: expectedSource.height, actualWidth: source.width, actualHeight: source.height });
  const validated = validateAtlasRectangles(rectangles, { sourceWidth: source.width, sourceHeight: source.height });
  const outputs = [];
  for (const rectangle of validated.rectangles.filter((candidate) => candidate.included)) {
    const rgba = Buffer.alloc(rectangle.width * rectangle.height * 4);
    for (let row = 0; row < rectangle.height; row += 1) {
      const sourceStart = ((rectangle.y + row) * source.width + rectangle.x) * 4;
      source.rgba.copy(rgba, row * rectangle.width * 4, sourceStart, sourceStart + rectangle.width * 4);
    }
    const png = encodeCanonicalRgbaPng({ width: rectangle.width, height: rectangle.height, rgba });
    const digest = createHash('sha256').update(png).digest('hex');
    outputs.push(Object.freeze({
      schemaVersion: 1,
      processorId: ATLAS_PROCESSOR_ID,
      rectangleId: rectangle.rectangleId,
      rectangle: structuredClone(rectangle),
      mediaType: 'image/png',
      width: rectangle.width,
      height: rectangle.height,
      byteSize: png.length,
      digest,
      expectedDigest: digest,
      bytes: png,
    }));
  }
  return Object.freeze({
    schemaVersion: 1,
    processorId: ATLAS_PROCESSOR_ID,
    source: { digest: sourceDigest, mediaType: 'image/png', width: source.width, height: source.height },
    rectangleFingerprint: validated.fingerprint,
    derivationFingerprint: createHash('sha256').update(JSON.stringify({
      schemaVersion: 1,
      processorId: ATLAS_PROCESSOR_ID,
      sourceDigest,
      sourceWidth: source.width,
      sourceHeight: source.height,
      rectangleFingerprint: validated.fingerprint,
    })).digest('hex'),
    outputs,
  });
}
