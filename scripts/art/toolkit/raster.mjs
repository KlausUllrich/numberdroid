import { deflateSync } from "node:zlib";

export function pixelOffset(width, x, y) {
  return (y * width + x) * 4;
}

export function getPixel(rgba, width, x, y) {
  const o = pixelOffset(width, x, y);
  return [rgba[o], rgba[o + 1], rgba[o + 2], rgba[o + 3]];
}

export function setPixel(rgba, width, x, y, color) {
  const o = pixelOffset(width, x, y);
  rgba[o] = color[0];
  rgba[o + 1] = color[1];
  rgba[o + 2] = color[2];
  rgba[o + 3] = color[3];
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const value of buf) c = crcTable[(c ^ value) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(tag, data) {
  const tagBytes = Buffer.from(tag);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  tagBytes.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([tagBytes, data])), 8 + data.length);
  return out;
}

export function encodeRgbaPng({ width, height, rgba }) {
  if (rgba.length !== width * height * 4) throw new Error("RGBA buffer size does not match width/height");
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength).copy(
      raw,
      y * (stride + 1) + 1,
      y * stride,
      (y + 1) * stride,
    );
  }

  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}
