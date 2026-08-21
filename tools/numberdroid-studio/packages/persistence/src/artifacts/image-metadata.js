import { StudioError, invariant } from '../../../domain/src/errors.js';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

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
