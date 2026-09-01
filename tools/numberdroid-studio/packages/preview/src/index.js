import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import {
  ATLAS_PROCESSOR_ID,
  MAX_ATLAS_INPUT_BYTES,
  MAX_ATLAS_OUTPUT_BYTES,
  MAX_ATLAS_OUTPUT_PIXELS,
  MAX_ATLAS_SOURCE_DIMENSION,
  canonicalRgbaPngByteSize,
  proposeRegularGrid,
  validateAtlasRectangles,
} from '../../domain/src/atlas-definition.js';
import { invariant } from '../../domain/src/errors.js';
import {
  processingRecipeSha256,
  validateProcessingRecipe,
} from '../../domain/src/processing-recipe.js';
import {
  PROCESSING_RESULT_KIND,
  PROCESSING_RESULT_SCHEMA_VERSION,
  validateProcessingResultForRecipe,
} from '../../domain/src/processing-result.js';

export * from './room-preview-scene.js';

export {
  ATLAS_PROCESSOR_ID,
  MAX_ATLAS_INPUT_BYTES,
  MAX_ATLAS_OUTPUT_BYTES,
  MAX_ATLAS_OUTPUT_PIXELS,
  MAX_ATLAS_RECTANGLES,
  MAX_ATLAS_SOURCE_DIMENSION,
  TRANSPARENT_PADDING_POLICY,
  canonicalRgbaPngByteSize,
  proposeRegularGrid,
  validateAtlasRectangles,
} from '../../domain/src/atlas-definition.js';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, 'buffer').get;
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, 'byteLength').get;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, 'byteOffset').get;

function inspectByteView(bytes) {
  invariant(Buffer.isBuffer(bytes) || bytes instanceof Uint8Array, 'ATLAS_PNG_INVALID', 'PNG input must be a byte buffer.');
  try {
    return {
      buffer: TYPED_ARRAY_BUFFER_GETTER.call(bytes),
      byteLength: TYPED_ARRAY_BYTE_LENGTH_GETTER.call(bytes),
      byteOffset: TYPED_ARRAY_BYTE_OFFSET_GETTER.call(bytes),
    };
  } catch {
    invariant(false, 'ATLAS_PNG_INVALID', 'PNG input must be a valid byte buffer.');
  }
}

function snapshotByteView(view) {
  try {
    return Buffer.from(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  } catch {
    invariant(false, 'ATLAS_PNG_INVALID', 'PNG input changed before it could be inspected safely.');
  }
}

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
  maxWidth = MAX_ATLAS_SOURCE_DIMENSION,
  maxHeight = MAX_ATLAS_SOURCE_DIMENSION,
  maxInputBytes = MAX_ATLAS_INPUT_BYTES,
} = {}) {
  const view = inspectByteView(bytes);
  safeInteger(maxInputBytes, 'maxInputBytes', { min: 33 });
  invariant(view.byteLength <= maxInputBytes, 'ATLAS_PNG_UNSUPPORTED', 'PNG input exceeds the audited cutter byte limit.', { maxInputBytes });
  const input = snapshotByteView(view);
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
  const view = inspectByteView(bytes);
  invariant(expectedSource && typeof expectedSource === 'object' && !Array.isArray(expectedSource), 'ATLAS_SOURCE_REQUIRED', 'An immutable expected source descriptor is required.');
  invariant(expectedSource.mediaType === 'image/png', 'ATLAS_PNG_UNSUPPORTED', 'Checkpoint 2B cuts only approved PNG sources.');
  invariant(typeof expectedSource.digest === 'string' && /^[a-f0-9]{64}$/.test(expectedSource.digest), 'ATLAS_SOURCE_REQUIRED', 'Expected source digest must be lowercase SHA-256 hex.');
  safeInteger(expectedSource.width, 'expectedSource.width', { min: 1 });
  safeInteger(expectedSource.height, 'expectedSource.height', { min: 1 });
  invariant(view.byteLength <= MAX_ATLAS_INPUT_BYTES, 'ATLAS_PNG_UNSUPPORTED', 'PNG input exceeds the audited cutter byte limit.', {
    maxInputBytes: MAX_ATLAS_INPUT_BYTES,
  });
  if (expectedSource.byteSize !== undefined) {
    safeInteger(expectedSource.byteSize, 'expectedSource.byteSize', {
      min: 33,
      max: MAX_ATLAS_INPUT_BYTES,
    });
    invariant(view.byteLength === expectedSource.byteSize, 'ATLAS_SOURCE_MISMATCH', 'Resolved source byte size does not match the approved source descriptor.', {
      expectedByteSize: expectedSource.byteSize,
      actualByteSize: view.byteLength,
    });
  }
  const immutableInput = snapshotByteView(view);
  const sourceDigest = createHash('sha256').update(immutableInput).digest('hex');
  invariant(sourceDigest === expectedSource.digest, 'ATLAS_SOURCE_MISMATCH', 'Resolved source bytes do not match the approved source digest.', { expectedDigest: expectedSource.digest, actualDigest: sourceDigest });
  const source = decodeSupportedPng(immutableInput);
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

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function projectExactPngCropProcessingRecipe(value) {
  const recipe = validateProcessingRecipe(value);
  const input = recipe.inputs[0];
  const operation = recipe.operations[0];
  return deepFreeze({
    schemaVersion: 1,
    recipeId: recipe.recipeId,
    recipeVersion: recipe.recipeVersion,
    recipeFingerprint: processingRecipeSha256(recipe),
    processorId: operation.processorId,
    source: {
      inputId: input.inputId,
      artifactUri: input.artifactUri,
      digest: input.sha256,
      mediaType: input.mediaType,
      byteSize: input.byteSize,
      width: input.width,
      height: input.height,
    },
    rectangles: operation.parameters.rectangles.map((rectangle) => ({
      rectangleId: rectangle.outputId,
      x: rectangle.x,
      y: rectangle.y,
      width: rectangle.width,
      height: rectangle.height,
      included: true,
      pivot: null,
      transparentPaddingPolicy: rectangle.transparentPaddingPolicy,
      replacesSliceId: null,
      expectedSliceVersion: null,
    })),
  });
}

function exactKernelFields(value, allowed, label) {
  invariant(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'PROCESSING_RESULT_KERNEL_MISMATCH',
    `${label} must be an object produced by the accepted crop kernel.`,
    { field: label },
  );
  for (const field of Reflect.ownKeys(value)) {
    invariant(
      typeof field === 'string' && allowed.includes(field),
      'PROCESSING_RESULT_KERNEL_MISMATCH',
      `${label} contains data outside the accepted crop-kernel result.`,
      { field: label },
    );
  }
  return value;
}

function exactKernelArray(value, length, label) {
  invariant(
    Array.isArray(value) && value.length === length,
    'PROCESSING_RESULT_KERNEL_MISMATCH',
    `${label} count does not match the processing recipe.`,
    { field: label },
  );
  for (let index = 0; index < value.length; index += 1) {
    invariant(
      Object.hasOwn(value, index),
      'PROCESSING_RESULT_KERNEL_MISMATCH',
      `${label} must not contain sparse entries.`,
      { field: label },
    );
  }
  const arrayKeys = new Set(['length', ...value.map((_, index) => String(index))]);
  for (const field of Reflect.ownKeys(value)) {
    invariant(
      typeof field === 'string' && arrayKeys.has(field),
      'PROCESSING_RESULT_KERNEL_MISMATCH',
      `${label} contains data outside the accepted crop-kernel result.`,
      { field: label },
    );
  }
  return value;
}

function assertKernelEqual(actual, expected, label) {
  invariant(
    actual === expected,
    'PROCESSING_RESULT_KERNEL_MISMATCH',
    `${label} does not match the accepted crop-kernel invocation.`,
    { field: label },
  );
}

export function createExactPngCropProcessingResult(value) {
  const definition = exactKernelFields(value, [
    'recipe', 'sourceBytes',
  ], 'definition');
  const recipe = validateProcessingRecipe(definition.recipe);
  const projection = projectExactPngCropProcessingRecipe(recipe);
  invariant(
    Buffer.isBuffer(definition.sourceBytes) || definition.sourceBytes instanceof Uint8Array,
    'PROCESSING_RESULT_KERNEL_MISMATCH',
    'definition.sourceBytes must contain the immutable recipe input bytes.',
    { field: 'definition.sourceBytes' },
  );
  const processorResult = exactKernelFields(cropSupportedPng(
    definition.sourceBytes,
    projection.rectangles,
    { expectedSource: projection.source },
  ), [
    'schemaVersion', 'processorId', 'source', 'rectangleFingerprint',
    'derivationFingerprint', 'outputs',
  ], 'processorResult');
  assertKernelEqual(processorResult.schemaVersion, 1, 'processorResult.schemaVersion');
  assertKernelEqual(processorResult.processorId, projection.processorId, 'processorResult.processorId');

  const source = exactKernelFields(processorResult.source, [
    'digest', 'mediaType', 'width', 'height',
  ], 'processorResult.source');
  assertKernelEqual(source.digest, projection.source.digest, 'processorResult.source.digest');
  assertKernelEqual(source.mediaType, projection.source.mediaType, 'processorResult.source.mediaType');
  assertKernelEqual(source.width, projection.source.width, 'processorResult.source.width');
  assertKernelEqual(source.height, projection.source.height, 'processorResult.source.height');

  const validatedRectangles = validateAtlasRectangles(projection.rectangles, {
    sourceWidth: projection.source.width,
    sourceHeight: projection.source.height,
  });
  assertKernelEqual(
    processorResult.rectangleFingerprint,
    validatedRectangles.fingerprint,
    'processorResult.rectangleFingerprint',
  );
  const expectedDerivationFingerprint = createHash('sha256').update(JSON.stringify({
    schemaVersion: 1,
    processorId: projection.processorId,
    sourceDigest: projection.source.digest,
    sourceWidth: projection.source.width,
    sourceHeight: projection.source.height,
    rectangleFingerprint: validatedRectangles.fingerprint,
  })).digest('hex');
  assertKernelEqual(
    processorResult.derivationFingerprint,
    expectedDerivationFingerprint,
    'processorResult.derivationFingerprint',
  );

  const kernelOutputs = exactKernelArray(
    processorResult.outputs,
    projection.rectangles.length,
    'processorResult.outputs',
  );
  const outputs = kernelOutputs.map((candidate, index) => {
    const label = `processorResult.outputs[${index}]`;
    const output = exactKernelFields(candidate, [
      'schemaVersion', 'processorId', 'rectangleId', 'rectangle', 'mediaType',
      'width', 'height', 'byteSize', 'digest', 'expectedDigest', 'bytes',
    ], label);
    const rectangle = projection.rectangles[index];
    assertKernelEqual(output.schemaVersion, 1, `${label}.schemaVersion`);
    assertKernelEqual(output.processorId, projection.processorId, `${label}.processorId`);
    assertKernelEqual(output.rectangleId, rectangle.rectangleId, `${label}.rectangleId`);
    const outputRectangle = exactKernelFields(output.rectangle, [
      'rectangleId', 'x', 'y', 'width', 'height', 'included', 'pivot',
      'transparentPaddingPolicy', 'replacesSliceId', 'expectedSliceVersion',
    ], `${label}.rectangle`);
    for (const field of [
      'rectangleId', 'x', 'y', 'width', 'height', 'included', 'pivot',
      'transparentPaddingPolicy', 'replacesSliceId', 'expectedSliceVersion',
    ]) {
      assertKernelEqual(outputRectangle[field], rectangle[field], `${label}.rectangle.${field}`);
    }
    assertKernelEqual(output.mediaType, 'image/png', `${label}.mediaType`);
    assertKernelEqual(output.width, rectangle.width, `${label}.width`);
    assertKernelEqual(output.height, rectangle.height, `${label}.height`);
    invariant(
      Buffer.isBuffer(output.bytes) || output.bytes instanceof Uint8Array,
      'PROCESSING_RESULT_KERNEL_MISMATCH',
      `${label}.bytes must contain the actual crop-kernel output bytes.`,
      { field: `${label}.bytes` },
    );
    const byteSize = canonicalRgbaPngByteSize(rectangle.width, rectangle.height);
    assertKernelEqual(output.bytes.byteLength, byteSize, `${label}.bytes`);
    const bytes = Buffer.from(output.bytes);
    const digest = createHash('sha256').update(bytes).digest('hex');
    assertKernelEqual(bytes.length, byteSize, `${label}.bytes`);
    assertKernelEqual(output.byteSize, byteSize, `${label}.byteSize`);
    assertKernelEqual(output.digest, digest, `${label}.digest`);
    assertKernelEqual(output.expectedDigest, digest, `${label}.expectedDigest`);
    let decoded;
    try {
      decoded = decodeSupportedPng(bytes, {
        maxWidth: rectangle.width,
        maxHeight: rectangle.height,
        maxInputBytes: MAX_ATLAS_OUTPUT_BYTES,
      });
    } catch {
      invariant(
        false,
        'PROCESSING_RESULT_KERNEL_MISMATCH',
        `${label}.bytes are not a supported canonical PNG artifact.`,
        { field: `${label}.bytes` },
      );
    }
    assertKernelEqual(decoded.width, rectangle.width, `${label}.bytes.width`);
    assertKernelEqual(decoded.height, rectangle.height, `${label}.bytes.height`);
    invariant(
      encodeCanonicalRgbaPng(decoded).equals(bytes),
      'PROCESSING_RESULT_KERNEL_MISMATCH',
      `${label}.bytes do not use the accepted canonical PNG encoding.`,
      { field: `${label}.bytes` },
    );
    return {
      outputId: rectangle.rectangleId,
      artifactUri: `studio://artifacts/sha256/${digest}`,
      sha256: digest,
      mediaType: 'image/png',
      byteSize,
      width: rectangle.width,
      height: rectangle.height,
    };
  });

  const operation = recipe.operations[0];
  const input = recipe.inputs[0];
  return validateProcessingResultForRecipe({
    schemaVersion: PROCESSING_RESULT_SCHEMA_VERSION,
    kind: PROCESSING_RESULT_KIND,
    recipe: {
      id: recipe.recipeId,
      version: recipe.recipeVersion,
      fingerprint: processingRecipeSha256(recipe),
    },
    operations: [{
      operationId: operation.operationId,
      kind: operation.kind,
      processorId: operation.processorId,
      inputs: [{ ...input }],
      outputs,
    }],
    findings: [],
  }, recipe);
}
