import { DatabaseSync } from 'node:sqlite';

export function nodeSqliteDatabaseFactory(filename, { timeout = 5000, readonly = false } = {}) {
  return new DatabaseSync(filename, { timeout, readOnly: readonly });
}

export function pngHeader({ width = 32, height = 32, tail = '' } = {}) {
  const bytes = Buffer.alloc(24 + Buffer.byteLength(tail));
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write('IHDR', 12, 'ascii');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  bytes.write(tail, 24);
  return bytes;
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
