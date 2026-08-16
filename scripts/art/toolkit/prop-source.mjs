import { inflateSync } from "node:zlib";
import { encodeRgbaPng } from "./raster.mjs";

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

function unfilterScanlines(raw, width, height, bytesPerPixel) {
  const stride = width * bytesPerPixel;
  const expected = height * (stride + 1);
  if (raw.length !== expected) {
    throw new Error(`PNG inflated byte count mismatch: expected ${expected}, got ${raw.length}.`);
  }

  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const srcStart = y * (stride + 1) + 1;
    const rowStart = y * stride;
    const prevStart = (y - 1) * stride;

    for (let x = 0; x < stride; x += 1) {
      const value = raw[srcStart + x];
      const left = x >= bytesPerPixel ? out[rowStart + x - bytesPerPixel] : 0;
      const up = y > 0 ? out[prevStart + x] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? out[prevStart + x - bytesPerPixel] : 0;
      let decoded;
      if (filter === 0) decoded = value;
      else if (filter === 1) decoded = (value + left) & 255;
      else if (filter === 2) decoded = (value + up) & 255;
      else if (filter === 3) decoded = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) decoded = (value + paeth(left, up, upLeft)) & 255;
      else throw new Error(`Unsupported PNG filter ${filter}.`);
      out[rowStart + x] = decoded;
    }
  }
  return out;
}

export function decodePngRgba(bytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Prop source is not a PNG file.");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = -1;
  const idat = [];

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buffer.length) throw new Error(`PNG chunk ${type} exceeds file bounds.`);
    const data = buffer.subarray(dataStart, dataEnd);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      const compression = data[10];
      const filter = data[11];
      interlace = data[12];
      if (compression !== 0 || filter !== 0) throw new Error("Unsupported PNG compression/filter method.");
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset = dataEnd + 4;
  }

  if (!width || !height || !idat.length) throw new Error("PNG is missing IHDR or IDAT data.");
  if (bitDepth !== 8) throw new Error(`Prop source PNG must use 8-bit channels; got ${bitDepth}.`);
  if (interlace !== 0) throw new Error("Interlaced PNG is not supported by the deterministic Prop preparation tool.");
  if (colorType !== 6 && colorType !== 2) {
    throw new Error(`Prop source PNG must be RGBA or RGB; unsupported color type ${colorType}.`);
  }

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const scanlines = unfilterScanlines(inflateSync(Buffer.concat(idat)), width, height, bytesPerPixel);
  const rgba = new Uint8Array(width * height * 4);
  let hasTransparency = false;

  for (let i = 0, j = 0; i < width * height; i += 1, j += bytesPerPixel) {
    const o = i * 4;
    rgba[o] = scanlines[j];
    rgba[o + 1] = scanlines[j + 1];
    rgba[o + 2] = scanlines[j + 2];
    rgba[o + 3] = colorType === 6 ? scanlines[j + 3] : 255;
    if (rgba[o + 3] < 255) hasTransparency = true;
  }

  return { width, height, rgba, hasTransparency };
}

export function normalizeLowAlpha(rgba, alphaCutoff = 0) {
  if (!Number.isInteger(alphaCutoff) || alphaCutoff < 0 || alphaCutoff > 255) {
    throw new Error("alphaCutoff must be an integer from 0 to 255.");
  }
  const out = new Uint8Array(rgba);
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] <= alphaCutoff) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
    }
  }
  return out;
}

export function alphaBounds(rgba, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (rgba[(y * width + x) * 4 + 3] === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function cropRgba(rgba, width, bounds) {
  const out = new Uint8Array(bounds.w * bounds.h * 4);
  for (let y = 0; y < bounds.h; y += 1) {
    const srcStart = ((bounds.y + y) * width + bounds.x) * 4;
    const dstStart = y * bounds.w * 4;
    out.set(rgba.subarray(srcStart, srcStart + bounds.w * 4), dstStart);
  }
  return out;
}

function sinc(x) {
  if (Math.abs(x) < 1e-9) return 1;
  const p = Math.PI * x;
  return Math.sin(p) / p;
}

function lanczos(x, a = 3) {
  const ax = Math.abs(x);
  if (ax >= a) return 0;
  return sinc(x) * sinc(x / a);
}

function resampleHorizontalPremultiplied(rgba, srcWidth, srcHeight, dstWidth) {
  const out = new Float64Array(dstWidth * srcHeight * 4);
  const scale = dstWidth / srcWidth;
  const support = scale < 1 ? 3 / scale : 3;

  for (let y = 0; y < srcHeight; y += 1) {
    for (let dx = 0; dx < dstWidth; dx += 1) {
      const center = (dx + 0.5) / scale - 0.5;
      const start = Math.max(0, Math.ceil(center - support));
      const end = Math.min(srcWidth - 1, Math.floor(center + support));
      let weightSum = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sx = start; sx <= end; sx += 1) {
        const distance = sx - center;
        const weight = scale < 1 ? lanczos(distance * scale) * scale : lanczos(distance);
        if (weight === 0) continue;
        const src = (y * srcWidth + sx) * 4;
        const alpha = rgba[src + 3] / 255;
        r += rgba[src] * alpha * weight;
        g += rgba[src + 1] * alpha * weight;
        b += rgba[src + 2] * alpha * weight;
        a += rgba[src + 3] * weight;
        weightSum += weight;
      }

      const dst = (y * dstWidth + dx) * 4;
      if (Math.abs(weightSum) > 1e-12) {
        out[dst] = r / weightSum;
        out[dst + 1] = g / weightSum;
        out[dst + 2] = b / weightSum;
        out[dst + 3] = a / weightSum;
      }
    }
  }
  return out;
}

function resampleVerticalFromPremultiplied(premultiplied, width, srcHeight, dstHeight) {
  const out = new Uint8Array(width * dstHeight * 4);
  const scale = dstHeight / srcHeight;
  const support = scale < 1 ? 3 / scale : 3;
  const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));

  for (let dy = 0; dy < dstHeight; dy += 1) {
    const center = (dy + 0.5) / scale - 0.5;
    const start = Math.max(0, Math.ceil(center - support));
    const end = Math.min(srcHeight - 1, Math.floor(center + support));

    for (let x = 0; x < width; x += 1) {
      let weightSum = 0;
      let pr = 0;
      let pg = 0;
      let pb = 0;
      let alpha = 0;
      for (let sy = start; sy <= end; sy += 1) {
        const distance = sy - center;
        const weight = scale < 1 ? lanczos(distance * scale) * scale : lanczos(distance);
        if (weight === 0) continue;
        const src = (sy * width + x) * 4;
        pr += premultiplied[src] * weight;
        pg += premultiplied[src + 1] * weight;
        pb += premultiplied[src + 2] * weight;
        alpha += premultiplied[src + 3] * weight;
        weightSum += weight;
      }

      const dst = (dy * width + x) * 4;
      if (Math.abs(weightSum) <= 1e-12) continue;
      const a = Math.max(0, Math.min(255, alpha / weightSum));
      out[dst + 3] = clamp(a);
      if (a > 1e-6) {
        const unpremultiply = 255 / a;
        out[dst] = clamp((pr / weightSum) * unpremultiply);
        out[dst + 1] = clamp((pg / weightSum) * unpremultiply);
        out[dst + 2] = clamp((pb / weightSum) * unpremultiply);
      }
    }
  }
  return out;
}

export function resizeLanczosPremultiplied(rgba, srcWidth, srcHeight, dstWidth, dstHeight) {
  if (![srcWidth, srcHeight, dstWidth, dstHeight].every((value) => Number.isInteger(value) && value > 0)) {
    throw new Error("Lanczos resize dimensions must be positive integers.");
  }
  if (srcWidth === dstWidth && srcHeight === dstHeight) return new Uint8Array(rgba);
  const horizontal = resampleHorizontalPremultiplied(rgba, srcWidth, srcHeight, dstWidth);
  return resampleVerticalFromPremultiplied(horizontal, dstWidth, srcHeight, dstHeight);
}

export function preparePropRgba({
  rgba,
  width,
  height,
  targetWidth,
  targetHeight,
  margin = 3,
  alphaCutoff = 4,
}) {
  if (!Number.isInteger(targetWidth) || !Number.isInteger(targetHeight) || targetWidth <= 0 || targetHeight <= 0) {
    throw new Error("Target Prop canvas dimensions must be positive integers.");
  }
  if (!Number.isInteger(margin) || margin < 0 || margin * 2 >= targetWidth || margin * 2 >= targetHeight) {
    throw new Error("Prop margin must be a non-negative integer smaller than half the target canvas.");
  }

  const normalized = normalizeLowAlpha(rgba, alphaCutoff);
  const sourceBounds = alphaBounds(normalized, width, height);
  if (!sourceBounds) throw new Error("Prop source contains no surviving alpha after cleanup.");
  const cropped = cropRgba(normalized, width, sourceBounds);
  const maxWidth = targetWidth - margin * 2;
  const maxHeight = targetHeight - margin * 2;
  const scale = Math.min(maxWidth / sourceBounds.w, maxHeight / sourceBounds.h);
  const contentWidth = Math.max(1, Math.min(maxWidth, Math.round(sourceBounds.w * scale)));
  const contentHeight = Math.max(1, Math.min(maxHeight, Math.round(sourceBounds.h * scale)));
  const resized = resizeLanczosPremultiplied(cropped, sourceBounds.w, sourceBounds.h, contentWidth, contentHeight);
  const output = new Uint8Array(targetWidth * targetHeight * 4);
  const offsetX = Math.floor((targetWidth - contentWidth) / 2);
  const offsetY = Math.floor((targetHeight - contentHeight) / 2);

  for (let y = 0; y < contentHeight; y += 1) {
    const srcStart = y * contentWidth * 4;
    const dstStart = ((offsetY + y) * targetWidth + offsetX) * 4;
    output.set(resized.subarray(srcStart, srcStart + contentWidth * 4), dstStart);
  }

  return {
    rgba: output,
    sourceBounds,
    contentBounds: { x: offsetX, y: offsetY, w: contentWidth, h: contentHeight },
    scale,
  };
}

export function preparePropPng({
  bytes,
  targetWidth,
  targetHeight,
  margin = 3,
  alphaCutoff = 4,
  requireTransparency = true,
}) {
  const decoded = decodePngRgba(bytes);
  if (requireTransparency && !decoded.hasTransparency) {
    throw new Error("Prop source has no alpha transparency. Generic semantic background removal is not implemented; obtain/prepare a transparent source first.");
  }
  const prepared = preparePropRgba({
    rgba: decoded.rgba,
    width: decoded.width,
    height: decoded.height,
    targetWidth,
    targetHeight,
    margin,
    alphaCutoff,
  });
  return {
    ...prepared,
    sourceWidth: decoded.width,
    sourceHeight: decoded.height,
    png: encodeRgbaPng({ width: targetWidth, height: targetHeight, rgba: prepared.rgba }),
  };
}
