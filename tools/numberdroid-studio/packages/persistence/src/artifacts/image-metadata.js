import { StudioError, invariant } from '../../../domain/src/errors.js';
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_DECODED_BYTES = 512 * 1024 * 1024;

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  return crc >>> 0;
});

function crc32(value) {
  let crc = 0xffffffff;
  for (const byte of value) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngDimensions(header) {
  invariant(header.length >= 24, 'ARTIFACT_MALFORMED', 'PNG header is truncated.');
  invariant(header.subarray(0, 8).equals(PNG_SIGNATURE), 'ARTIFACT_MEDIA_MISMATCH', 'Bytes are not a PNG image.');
  invariant(header.toString('ascii', 12, 16) === 'IHDR', 'ARTIFACT_MALFORMED', 'PNG has no leading IHDR chunk.');
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

function webpDimensions(header) {
  invariant(header.length >= 30, 'ARTIFACT_MALFORMED', 'WebP header is truncated.');
  invariant(
    header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP',
    'ARTIFACT_MEDIA_MISMATCH',
    'Bytes are not a WebP image.',
  );
  const kind = header.toString('ascii', 12, 16);
  if (kind === 'VP8X') {
    return {
      width: 1 + header.readUIntLE(24, 3),
      height: 1 + header.readUIntLE(27, 3),
    };
  }
  if (kind === 'VP8L') {
    invariant(header[20] === 0x2f, 'ARTIFACT_MALFORMED', 'WebP lossless signature is invalid.');
    return {
      width: 1 + header[21] + ((header[22] & 0x3f) << 8),
      height: 1 + ((header[22] & 0xc0) >> 6) + (header[23] << 2) + ((header[24] & 0x0f) << 10),
    };
  }
  if (kind === 'VP8 ') {
    invariant(
      header[23] === 0x9d && header[24] === 0x01 && header[25] === 0x2a,
      'ARTIFACT_MALFORMED',
      'WebP lossy frame signature is invalid.',
    );
    return {
      width: header.readUInt16LE(26) & 0x3fff,
      height: header.readUInt16LE(28) & 0x3fff,
    };
  }
  throw new StudioError('ARTIFACT_UNSUPPORTED_MEDIA', `Unsupported WebP chunk type: ${kind}.`);
}

export function inspectImageHeader(header, mediaType) {
  const dimensions = mediaType === 'image/png'
    ? pngDimensions(header)
    : mediaType === 'image/webp'
      ? webpDimensions(header)
      : null;
  if (!dimensions) throw new StudioError('ARTIFACT_UNSUPPORTED_MEDIA', `Unsupported artifact media type: ${mediaType}.`);
  invariant(dimensions.width > 0 && dimensions.height > 0, 'ARTIFACT_MALFORMED', 'Image dimensions must be positive.');
  return dimensions;
}

function validatePng(bytes) {
  invariant(bytes.length >= 45 && bytes.subarray(0, 8).equals(PNG_SIGNATURE), 'ARTIFACT_MALFORMED', 'PNG structure is truncated.');
  let offset = 8;
  let ihdr = null;
  let sawIdat = false;
  let sawIend = false;
  const idat = [];
  while (offset < bytes.length) {
    invariant(offset + 12 <= bytes.length, 'ARTIFACT_MALFORMED', 'PNG chunk header is truncated.');
    const length = bytes.readUInt32BE(offset);
    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const type = typeBytes.toString('ascii');
    const dataStart = offset + 8;
    const crcOffset = dataStart + length;
    invariant(crcOffset + 4 <= bytes.length, 'ARTIFACT_MALFORMED', `PNG ${type} chunk is truncated.`);
    const data = bytes.subarray(dataStart, crcOffset);
    const expectedCrc = bytes.readUInt32BE(crcOffset);
    invariant(crc32(Buffer.concat([typeBytes, data])) === expectedCrc, 'ARTIFACT_MALFORMED', `PNG ${type} CRC is invalid.`);
    if (ihdr === null) {
      invariant(type === 'IHDR' && length === 13, 'ARTIFACT_MALFORMED', 'PNG must start with one 13-byte IHDR chunk.');
      ihdr = Buffer.from(data);
    } else if (type === 'IHDR') {
      throw new StudioError('ARTIFACT_MALFORMED', 'PNG contains more than one IHDR chunk.');
    }
    if (type === 'IDAT') {
      sawIdat = true;
      idat.push(Buffer.from(data));
    }
    if (type === 'IEND') {
      invariant(length === 0 && sawIdat, 'ARTIFACT_MALFORMED', 'PNG IEND requires prior image data and no payload.');
      sawIend = true;
      offset = crcOffset + 4;
      break;
    }
    offset = crcOffset + 4;
  }
  invariant(sawIend && offset === bytes.length, 'ARTIFACT_MALFORMED', 'PNG must end exactly after IEND.');
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  invariant(ihdr[10] === 0 && ihdr[11] === 0 && ihdr[12] === 0, 'ARTIFACT_MALFORMED', 'PNG compression, filtering, or interlace method is unsupported.');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  const allowedDepths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] }[colorType];
  invariant(channels && allowedDepths.includes(bitDepth), 'ARTIFACT_MALFORMED', 'PNG color type and bit depth combination is invalid.');
  const rowBytes = Math.ceil((width * channels * bitDepth) / 8);
  const expectedDecodedBytes = (rowBytes + 1) * height;
  invariant(expectedDecodedBytes <= MAX_DECODED_BYTES, 'ARTIFACT_DIMENSIONS_EXCEEDED', 'PNG decoded byte size exceeds the validation limit.');
  let decoded;
  try {
    decoded = inflateSync(Buffer.concat(idat), { maxOutputLength: expectedDecodedBytes });
  } catch (error) {
    throw new StudioError('ARTIFACT_MALFORMED', 'PNG image data is not a valid bounded zlib stream.', { cause: error.code ?? error.message });
  }
  invariant(decoded.length === expectedDecodedBytes, 'ARTIFACT_MALFORMED', 'PNG decoded image data length does not match IHDR.');
  for (let row = 0; row < height; row += 1) {
    invariant(decoded[row * (rowBytes + 1)] <= 4, 'ARTIFACT_MALFORMED', 'PNG scanline uses an invalid filter type.');
  }
}

function validateWebp(bytes) {
  invariant(bytes.length >= 20, 'ARTIFACT_MALFORMED', 'WebP structure is truncated.');
  invariant(bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP', 'ARTIFACT_MEDIA_MISMATCH', 'Bytes are not a WebP image.');
  invariant(bytes.readUInt32LE(4) + 8 === bytes.length, 'ARTIFACT_MALFORMED', 'WebP RIFF length does not match the artifact size.');
  let offset = 12;
  let chunks = 0;
  while (offset < bytes.length) {
    invariant(offset + 8 <= bytes.length, 'ARTIFACT_MALFORMED', 'WebP chunk header is truncated.');
    const length = bytes.readUInt32LE(offset + 4);
    offset += 8 + length + (length % 2);
    invariant(offset <= bytes.length, 'ARTIFACT_MALFORMED', 'WebP chunk payload is truncated.');
    chunks += 1;
  }
  invariant(chunks > 0 && offset === bytes.length, 'ARTIFACT_MALFORMED', 'WebP contains no complete chunks.');
}

export async function verifyImageFile(path, mediaType) {
  const bytes = await readFile(path);
  if (mediaType === 'image/png') validatePng(bytes);
  else if (mediaType === 'image/webp') validateWebp(bytes);
  else throw new StudioError('ARTIFACT_UNSUPPORTED_MEDIA', `Unsupported artifact media type: ${mediaType}.`);
}
