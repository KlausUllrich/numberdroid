import { deflateSync } from "node:zlib";

function pixelOffset(width, x, y) {
  return (y * width + x) * 4;
}

function sidePosition(side, x, y) {
  return side === "L" || side === "R" ? y : x;
}

function isConnectorAt(connectors, side, x, y) {
  const p = sidePosition(side, x, y);
  return connectors.some((c) => c.side === side && p >= c.start && p < c.end);
}

export function createMask(width, height, predicate) {
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      mask[y * width + x] = predicate(x, y) ? 1 : 0;
    }
  }
  return mask;
}

export function exposedBoundaryMask({ width, height, mask, connectors = [] }) {
  const boundary = new Uint8Array(width * height);
  const dirs = [
    [-1, 0, "L"],
    [1, 0, "R"],
    [0, -1, "T"],
    [0, 1, "B"],
  ];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x;
      if (!mask[p]) continue;

      for (const [dx, dy, side] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          if (!mask[ny * width + nx]) {
            boundary[p] = 1;
            break;
          }
        } else if (!isConnectorAt(connectors, side, x, y)) {
          boundary[p] = 1;
          break;
        }
      }
    }
  }

  return boundary;
}

export function distanceFromBoundary({ width, height, mask, boundary }) {
  const distance = new Int16Array(width * height);
  distance.fill(-1);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  for (let p = 0; p < boundary.length; p += 1) {
    if (boundary[p] && mask[p]) {
      distance[p] = 0;
      queue[tail++] = p;
    }
  }

  if (tail === 0) return distance;

  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (head < tail) {
    const p = queue[head++];
    const x = p % width;
    const y = Math.floor(p / width);
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const np = ny * width + nx;
      if (!mask[np] || distance[np] >= 0) continue;
      distance[np] = distance[p] + 1;
      queue[tail++] = np;
    }
  }

  return distance;
}

export function renderMaskedMaterial({
  width,
  height,
  mask,
  connectors = [],
  materialSampler,
  worldOffsetX = 0,
  worldOffsetY = 0,
  outerDarkPx = 5,
  outerDarkStrength = 0.28,
  innerHighlightCenterPx = 3,
  innerHighlightWidthPx = 1.35,
  innerHighlightStrength = 0.035,
}) {
  const boundary = exposedBoundaryMask({ width, height, mask, connectors });
  const distance = distanceFromBoundary({ width, height, mask, boundary });
  const rgba = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x;
      const o = p * 4;
      if (!mask[p]) continue;

      const [mr, mg, mb] = materialSampler(x + worldOffsetX, y + worldOffsetY);
      const d = distance[p] < 0 ? 999 : distance[p];
      const darkWeight = Math.max(0, 1 - d / outerDarkPx);
      const darkFactor = 1 - outerDarkStrength * darkWeight;
      const hd = (d - innerHighlightCenterPx) / innerHighlightWidthPx;
      const highlight = Math.exp(-0.5 * hd * hd) * innerHighlightStrength;

      const channels = [mr, mg, mb];
      for (let c = 0; c < 3; c += 1) {
        const value = channels[c] * darkFactor + 255 * highlight;
        rgba[o + c] = Math.max(0, Math.min(255, Math.round(value)));
      }
      rgba[o + 3] = 255;
    }
  }

  return { rgba, boundary, distance };
}

function getPixel(rgba, width, x, y) {
  const o = pixelOffset(width, x, y);
  return [rgba[o], rgba[o + 1], rgba[o + 2], rgba[o + 3]];
}

function setPixel(rgba, width, x, y, color) {
  const o = pixelOffset(width, x, y);
  rgba[o] = color[0];
  rgba[o + 1] = color[1];
  rgba[o + 2] = color[2];
  rgba[o + 3] = color[3];
}

function connectorPixel(width, height, side, p, inward = 0) {
  if (side === "L") return [inward, p];
  if (side === "R") return [width - 1 - inward, p];
  if (side === "T") return [p, inward];
  return [p, height - 1 - inward];
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

export function canonicalizeConnectorGroup({ width, height, tiles, members, blendPx = 6 }) {
  if (members.length < 2) throw new Error("canonicalizeConnectorGroup requires at least two members");
  const length = members[0].end - members[0].start;
  for (const member of members) {
    if (member.end - member.start !== length) throw new Error("connector members must have equal strip length");
  }

  const canonical = Array.from({ length }, (_, i) => {
    return Array.from({ length: 4 }, (_, c) => {
      const values = members.map((member) => {
        const p = member.start + i;
        const [x, y] = connectorPixel(width, height, member.side, p, 0);
        return getPixel(tiles[member.tile], width, x, y)[c];
      });
      return Math.round(median(values));
    });
  });

  for (const member of members) {
    const tile = tiles[member.tile];
    for (let i = 0; i < length; i += 1) {
      const p = member.start + i;
      for (let inward = 0; inward < blendPx; inward += 1) {
        const [x, y] = connectorPixel(width, height, member.side, p, inward);
        const old = getPixel(tile, width, x, y);
        if (old[3] === 0) continue;
        const w = Math.max(0, 1 - inward / blendPx);
        const next = old.map((v, c) => Math.round(v + w * (canonical[i][c] - v)));
        next[3] = 255;
        setPixel(tile, width, x, y, next);
      }
    }
  }

  return canonical;
}

export function meanConnectorDifference({ width, height, tiles, a, b }) {
  const length = a.end - a.start;
  if (b.end - b.start !== length) throw new Error("connector comparison requires equal lengths");
  let total = 0;
  let count = 0;
  for (let i = 0; i < length; i += 1) {
    const [ax, ay] = connectorPixel(width, height, a.side, a.start + i, 0);
    const [bx, by] = connectorPixel(width, height, b.side, b.start + i, 0);
    const pa = getPixel(tiles[a.tile], width, ax, ay);
    const pb = getPixel(tiles[b.tile], width, bx, by);
    for (let c = 0; c < 4; c += 1) {
      total += Math.abs(pa[c] - pb[c]);
      count += 1;
    }
  }
  return count ? total / count : 0;
}

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const v of buf) c = crcTable[(c ^ v) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(tag, data) {
  const t = Buffer.from(tag);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  t.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([t, data])), 8 + data.length);
  return out;
}

export function encodeRgbaPng({ width, height, rgba }) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}
