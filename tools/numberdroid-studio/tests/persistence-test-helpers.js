import { DatabaseSync } from 'node:sqlite';
import { deflateSync } from 'node:zlib';

const cleanupStacks = new WeakMap();

export function afterTestCleanup(context, cleanup) {
  if (typeof cleanup !== 'function') throw new TypeError('Test cleanup must be a function.');
  let stack = cleanupStacks.get(context);
  if (!stack) {
    stack = [];
    cleanupStacks.set(context, stack);
    context.after(async () => {
      const errors = [];
      while (stack.length > 0) {
        try {
          await stack.pop()();
        } catch (error) {
          errors.push(error);
        }
      }
      cleanupStacks.delete(context);
      if (errors.length === 1) throw errors[0];
      if (errors.length > 1) throw new AggregateError(errors, 'Multiple test cleanups failed.');
    });
  }
  stack.push(cleanup);
}

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

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return chunk;
}

export function nodeSqliteDatabaseFactory(filename, { timeout = 5000, readonly = false } = {}) {
  return new DatabaseSync(filename, { timeout, readOnly: readonly });
}

export function pngHeader({ width = 32, height = 32, tail = '' } = {}) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 0;
  const rows = Buffer.alloc((width + 1) * height);
  for (let row = 0; row < height; row += 1) rows[row * (width + 1)] = 0;
  const chunks = [pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(rows))];
  if (tail) chunks.push(pngChunk('tEXt', Buffer.from(`fixture\0${tail}`, 'utf8')));
  chunks.push(pngChunk('IEND', Buffer.alloc(0)));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ...chunks]);
}

export function webpExtendedHeader({ width = 32, height = 32 } = {}) {
  const bytes = Buffer.alloc(30);
  bytes.write('RIFF', 0, 'ascii');
  bytes.writeUInt32LE(22, 4);
  bytes.write('WEBP', 8, 'ascii');
  bytes.write('VP8X', 12, 'ascii');
  bytes.writeUInt32LE(10, 16);
  bytes.writeUIntLE(width - 1, 24, 3);
  bytes.writeUIntLE(height - 1, 27, 3);
  return bytes;
}
