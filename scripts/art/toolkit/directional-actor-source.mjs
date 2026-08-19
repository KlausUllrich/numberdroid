import { inflateSync } from "node:zlib";
import { decodePngRgba } from "./prop-source.mjs";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function unfilterIndexed(raw, rowBytes, height) {
  const expected = height * (rowBytes + 1);
  if (raw.length !== expected) throw new Error(`Indexed PNG inflated byte count mismatch: expected ${expected}, got ${raw.length}.`);
  const out = Buffer.alloc(height * rowBytes);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (rowBytes + 1)];
    const srcStart = y * (rowBytes + 1) + 1;
    const rowStart = y * rowBytes;
    const prevStart = (y - 1) * rowBytes;
    for (let x = 0; x < rowBytes; x += 1) {
      const value = raw[srcStart + x];
      const left = x > 0 ? out[rowStart + x - 1] : 0;
      const up = y > 0 ? out[prevStart + x] : 0;
      const upLeft = y > 0 && x > 0 ? out[prevStart + x - 1] : 0;
      if (filter === 0) out[rowStart + x] = value;
      else if (filter === 1) out[rowStart + x] = (value + left) & 255;
      else if (filter === 2) out[rowStart + x] = (value + up) & 255;
      else if (filter === 3) out[rowStart + x] = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) out[rowStart + x] = (value + paeth(left, up, upLeft)) & 255;
      else throw new Error(`Unsupported PNG filter ${filter}.`);
    }
  }
  return out;
}

function paletteIndex(scanlines, rowBytes, bitDepth, x, y) {
  const rowStart = y * rowBytes;
  if (bitDepth === 8) return scanlines[rowStart + x];
  const perByte = 8 / bitDepth;
  const packed = scanlines[rowStart + Math.floor(x / perByte)];
  const shift = 8 - bitDepth * ((x % perByte) + 1);
  return (packed >> shift) & ((1 << bitDepth) - 1);
}

function decodeIndexedPngRgba(bytes) {
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = -1;
  let palette = null;
  let transparency = null;
  const idat = [];

  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > bytes.length) throw new Error(`PNG chunk ${type} exceeds bounds.`);
    const data = bytes.subarray(start, end);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "PLTE") palette = Buffer.from(data);
    else if (type === "tRNS") transparency = Buffer.from(data);
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    offset = end + 4;
  }

  if (colorType !== 3) throw new Error(`Expected indexed PNG (type 3), got ${colorType}.`);
  if (![1, 2, 4, 8].includes(bitDepth)) throw new Error(`Unsupported indexed PNG bit depth ${bitDepth}.`);
  if (interlace !== 0) throw new Error("Interlaced indexed PNG is not supported for directional actor analysis.");
  if (!palette || !idat.length) throw new Error("Indexed PNG missing PLTE or IDAT.");

  const rowBytes = Math.ceil(width * bitDepth / 8);
  const scanlines = unfilterIndexed(inflateSync(Buffer.concat(idat)), rowBytes, height);
  const rgba = new Uint8Array(width * height * 4);
  const paletteEntries = palette.length / 3;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = paletteIndex(scanlines, rowBytes, bitDepth, x, y);
      if (index >= paletteEntries) throw new Error(`Palette index ${index} exceeds ${paletteEntries} entries.`);
      const po = index * 3;
      const o = (y * width + x) * 4;
      rgba[o] = palette[po];
      rgba[o + 1] = palette[po + 1];
      rgba[o + 2] = palette[po + 2];
      rgba[o + 3] = transparency && index < transparency.length ? transparency[index] : 255;
    }
  }
  return { width, height, rgba, hasTransparency: Boolean(transparency), colorType, bitDepth, paletteEntries };
}

export function decodeDirectionalActorPngRgba(bytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("Directional actor source is not PNG.");
  const colorType = buffer[25];
  if (colorType === 3) return decodeIndexedPngRgba(buffer);
  return decodePngRgba(buffer);
}

function componentizeFrame(rgba, stripWidth, frameIndex, frameSize, alphaThreshold) {
  const labels = new Int32Array(frameSize * frameSize);
  const components = [];
  let nextLabel = 0;
  const frameX = frameIndex * frameSize;
  const isOn = (x, y) => rgba[(y * stripWidth + frameX + x) * 4 + 3] >= alphaThreshold;
  const queueX = new Int16Array(frameSize * frameSize);
  const queueY = new Int16Array(frameSize * frameSize);

  for (let y = 0; y < frameSize; y += 1) {
    for (let x = 0; x < frameSize; x += 1) {
      const start = y * frameSize + x;
      if (labels[start] || !isOn(x, y)) continue;
      nextLabel += 1;
      let head = 0;
      let tail = 0;
      queueX[tail] = x;
      queueY[tail] = y;
      tail += 1;
      labels[start] = nextLabel;
      let area = 0;
      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;
      let sumX = 0;
      let sumY = 0;

      while (head < tail) {
        const cx = queueX[head];
        const cy = queueY[head];
        head += 1;
        area += 1;
        minX = Math.min(minX, cx);
        minY = Math.min(minY, cy);
        maxX = Math.max(maxX, cx);
        maxY = Math.max(maxY, cy);
        sumX += cx;
        sumY += cy;

        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= frameSize || ny >= frameSize) continue;
            const ni = ny * frameSize + nx;
            if (labels[ni] || !isOn(nx, ny)) continue;
            labels[ni] = nextLabel;
            queueX[tail] = nx;
            queueY[tail] = ny;
            tail += 1;
          }
        }
      }

      components.push({
        label: nextLabel,
        area,
        minX,
        minY,
        maxX,
        maxY,
        w: maxX - minX + 1,
        h: maxY - minY + 1,
        centroidX: sumX / area,
        centroidY: sumY / area,
      });
    }
  }
  components.sort((a, b) => b.area - a.area);
  return { labels, components };
}

function bboxDistance(a, b) {
  const dx = a.maxX < b.minX ? b.minX - a.maxX - 1 : b.maxX < a.minX ? a.minX - b.maxX - 1 : 0;
  const dy = a.maxY < b.minY ? b.minY - a.maxY - 1 : b.maxY < a.minY ? a.minY - b.maxY - 1 : 0;
  return Math.max(dx, dy);
}

function supportClusters(labels, mainLabel, frameSize, footY, band, minPixels) {
  const counts = new Int16Array(frameSize);
  const startY = Math.max(0, footY - band + 1);
  for (let y = startY; y <= footY; y += 1) {
    for (let x = 0; x < frameSize; x += 1) {
      if (labels[y * frameSize + x] === mainLabel) counts[x] += 1;
    }
  }
  const occupied = [];
  for (let x = 0; x < frameSize; x += 1) if (counts[x] > 0) occupied.push(x);
  const groups = [];
  if (occupied.length) {
    let current = [occupied[0]];
    for (let i = 1; i < occupied.length; i += 1) {
      if (occupied[i] <= occupied[i - 1] + 2) current.push(occupied[i]);
      else {
        groups.push(current);
        current = [occupied[i]];
      }
    }
    groups.push(current);
  }
  return groups.map((group) => {
    let score = 0;
    let weightedX = 0;
    for (const x of group) {
      score += counts[x];
      weightedX += x * counts[x];
    }
    return { minX: group[0], maxX: group[group.length - 1], score, x: weightedX / score };
  }).filter((group) => group.score >= minPixels).sort((a, b) => a.x - b.x);
}

export function analyzeDirectionalActorStrip({
  rgba,
  width,
  height,
  frameSize = height,
  structuralAlpha = 32,
  minDetachedArea = 4,
  supportBand = 6,
  minSupportPixels = 12,
}) {
  if (height !== frameSize || width % frameSize !== 0) throw new Error(`Directional strip must be Nx${frameSize} by ${frameSize}; got ${width}x${height}.`);
  const frames = [];
  const frameCount = width / frameSize;
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const structural = componentizeFrame(rgba, width, frameIndex, frameSize, structuralAlpha);
    const main = structural.components[0];
    if (!main) throw new Error(`Directional frame ${frameIndex} has no structural pixels at alpha >= ${structuralAlpha}.`);
    const detachedBelow = structural.components.slice(1).filter((component) => component.area >= minDetachedArea && component.minY > main.maxY);
    frames.push({
      frameIndex,
      main: { ...main },
      footY: main.maxY,
      detachedBelow: detachedBelow.map((component) => ({ ...component })),
      suggestedSupports: supportClusters(structural.labels, main.label, frameSize, main.maxY, supportBand, minSupportPixels),
    });
  }
  return { frameCount, frameSize, structuralAlpha, frames };
}

export function sanitizeDirectionalActorStrip({
  rgba,
  width,
  height,
  frameSize = height,
  structuralAlpha = 32,
  minDetachedArea = 4,
  haloDistance = 2,
}) {
  const out = new Uint8Array(rgba);
  const before = analyzeDirectionalActorStrip({ rgba, width, height, frameSize, structuralAlpha, minDetachedArea });
  const removed = [];

  for (const frame of before.frames) {
    if (frame.detachedBelow.length === 0) continue;
    const visible = componentizeFrame(rgba, width, frame.frameIndex, frameSize, 1);
    const mainVisible = visible.components[0];
    const labelsToRemove = new Set();
    for (const fragment of frame.detachedBelow) {
      for (const component of visible.components.slice(1)) {
        if (component.label === mainVisible?.label) continue;
        if (bboxDistance(component, fragment) <= haloDistance) labelsToRemove.add(component.label);
      }
    }

    let removedPixels = 0;
    const frameX = frame.frameIndex * frameSize;
    for (let y = 0; y < frameSize; y += 1) {
      for (let x = 0; x < frameSize; x += 1) {
        const label = visible.labels[y * frameSize + x];
        if (!labelsToRemove.has(label)) continue;
        const o = (y * width + frameX + x) * 4;
        if (out[o + 3] === 0) continue;
        out[o] = 0;
        out[o + 1] = 0;
        out[o + 2] = 0;
        out[o + 3] = 0;
        removedPixels += 1;
      }
    }
    removed.push({ frameIndex: frame.frameIndex, structuralFragments: frame.detachedBelow, visiblePixelsRemoved: removedPixels });
  }

  const after = analyzeDirectionalActorStrip({ rgba: out, width, height, frameSize, structuralAlpha, minDetachedArea });
  return { rgba: out, before, after, removed };
}

export function nearestDistanceToMainStructural({
  rgba,
  width,
  frameIndex,
  frameSize,
  x,
  y,
  structuralAlpha = 32,
}) {
  const structural = componentizeFrame(rgba, width, frameIndex, frameSize, structuralAlpha);
  const main = structural.components[0];
  if (!main) return Infinity;
  let best = Infinity;
  for (let py = 0; py < frameSize; py += 1) {
    for (let px = 0; px < frameSize; px += 1) {
      if (structural.labels[py * frameSize + px] !== main.label) continue;
      best = Math.min(best, Math.hypot(px - x, py - y));
    }
  }
  return best;
}
