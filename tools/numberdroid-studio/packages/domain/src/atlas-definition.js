import { createHash } from 'node:crypto';
import { invariant } from './errors.js';

export const ATLAS_PROCESSOR_ID = 'numberdroid-studio.exact-png-crop.v1';
export const MAX_ATLAS_INPUT_BYTES = 16 * 1024 * 1024;
export const MAX_ATLAS_SOURCE_DIMENSION = 4096;
export const MAX_ATLAS_RECTANGLES = 64;
export const MAX_ATLAS_OUTPUT_PIXELS = 64 * 1024 * 1024;
export const MAX_ATLAS_OUTPUT_BYTES = 16 * 1024 * 1024;
// Initial execution plus at most two explicit/recovery retries. This bounds
// non-revision job work even though retries do not consume semantic commands.
export const MAX_ATLAS_JOB_ATTEMPTS = 3;
export const TRANSPARENT_PADDING_POLICY = 'preserve_exact_rect';

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function safeInteger(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  invariant(Number.isSafeInteger(value) && value >= min && value <= max, 'ATLAS_RECT_INVALID', `${field} must be a safe integer from ${min} to ${max}.`, { field });
  return value;
}

function opaqueId(value, field) {
  invariant(typeof value === 'string' && ID_PATTERN.test(value), 'ATLAS_RECT_INVALID', `${field} must be an opaque Studio ID.`, { field });
  return value;
}

function stableFingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function rectanglesOverlap(left, right) {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}

export function canonicalRgbaPngByteSize(width, height) {
  safeInteger(width, 'width', { min: 1 });
  safeInteger(height, 'height', { min: 1 });
  const rowBytes = width * 4 + 1;
  invariant(Number.isSafeInteger(rowBytes), 'ATLAS_OUTPUT_LIMIT', 'Canonical PNG row-byte arithmetic overflowed.');
  const rawBytes = rowBytes * height;
  invariant(Number.isSafeInteger(rawBytes), 'ATLAS_OUTPUT_LIMIT', 'Canonical PNG byte arithmetic overflowed.');
  const storedBlocks = Math.ceil(rawBytes / 65535);
  const byteSize = 63 + rawBytes + storedBlocks * 5;
  invariant(Number.isSafeInteger(byteSize), 'ATLAS_OUTPUT_LIMIT', 'Canonical PNG encoded-size arithmetic overflowed.');
  return byteSize;
}

export function validateAtlasRectangles(rectangles, {
  sourceWidth,
  sourceHeight,
  maxRectangles = MAX_ATLAS_RECTANGLES,
  maxOutputPixels = MAX_ATLAS_OUTPUT_PIXELS,
  maxOutputBytes = MAX_ATLAS_OUTPUT_BYTES,
} = {}) {
  safeInteger(sourceWidth, 'sourceWidth', { min: 1 });
  safeInteger(sourceHeight, 'sourceHeight', { min: 1 });
  safeInteger(maxRectangles, 'maxRectangles', { min: 1, max: MAX_ATLAS_RECTANGLES });
  safeInteger(maxOutputPixels, 'maxOutputPixels', { min: 1, max: MAX_ATLAS_OUTPUT_PIXELS });
  safeInteger(maxOutputBytes, 'maxOutputBytes', { min: 1, max: MAX_ATLAS_OUTPUT_BYTES });
  invariant(Array.isArray(rectangles) && rectangles.length > 0 && rectangles.length <= maxRectangles, 'ATLAS_RECT_LIMIT', `Atlas definitions require 1 to ${maxRectangles} rectangles.`, { maxRectangles });

  const ids = new Set();
  const geometries = new Set();
  const replacementIds = new Set();
  const normalized = [];
  let totalOutputPixels = 0;
  let totalOutputBytes = 0;

  for (const [index, candidate] of rectangles.entries()) {
    invariant(candidate && typeof candidate === 'object' && !Array.isArray(candidate), 'ATLAS_RECT_INVALID', `rectangles[${index}] must be an object.`);
    const rectangleId = opaqueId(candidate.rectangleId, `rectangles[${index}].rectangleId`);
    invariant(!ids.has(rectangleId), 'ATLAS_RECT_DUPLICATE_ID', 'Rectangle IDs must be unique.', { rectangleId });
    ids.add(rectangleId);
    const x = safeInteger(candidate.x, `rectangles[${index}].x`);
    const y = safeInteger(candidate.y, `rectangles[${index}].y`);
    const width = safeInteger(candidate.width, `rectangles[${index}].width`, { min: 1 });
    const height = safeInteger(candidate.height, `rectangles[${index}].height`, { min: 1 });
    invariant(x <= sourceWidth && width <= sourceWidth - x, 'ATLAS_RECT_OUT_OF_BOUNDS', 'Rectangle exceeds the source width.', { rectangleId, sourceWidth });
    invariant(y <= sourceHeight && height <= sourceHeight - y, 'ATLAS_RECT_OUT_OF_BOUNDS', 'Rectangle exceeds the source height.', { rectangleId, sourceHeight });
    invariant(typeof candidate.included === 'boolean', 'ATLAS_RECT_INVALID', 'Rectangle inclusion must be explicit.', { rectangleId });
    invariant(candidate.transparentPaddingPolicy === TRANSPARENT_PADDING_POLICY, 'ATLAS_PADDING_POLICY_UNSUPPORTED', `Checkpoint 2B supports only ${TRANSPARENT_PADDING_POLICY}.`, { rectangleId });

    let pivot = null;
    if (candidate.pivot !== null) {
      invariant(candidate.pivot && typeof candidate.pivot === 'object' && !Array.isArray(candidate.pivot), 'ATLAS_RECT_INVALID', 'Pivot must be null or local integer coordinates.', { rectangleId });
      pivot = {
        x: safeInteger(candidate.pivot.x, `rectangles[${index}].pivot.x`, { max: width - 1 }),
        y: safeInteger(candidate.pivot.y, `rectangles[${index}].pivot.y`, { max: height - 1 }),
      };
    }

    const replacesSliceId = candidate.replacesSliceId === null
      ? null
      : opaqueId(candidate.replacesSliceId, `rectangles[${index}].replacesSliceId`);
    const expectedSliceVersion = replacesSliceId === null
      ? null
      : safeInteger(candidate.expectedSliceVersion, `rectangles[${index}].expectedSliceVersion`, { min: 1 });
    invariant(replacesSliceId !== null || candidate.expectedSliceVersion === null, 'ATLAS_REMAP_INVALID', 'A slice version is valid only with an explicit replacement slice.', { rectangleId });
    invariant(candidate.included || (replacesSliceId === null && expectedSliceVersion === null), 'ATLAS_REMAP_INVALID', 'An excluded rectangle cannot replace a committed slice.', { rectangleId });
    if (replacesSliceId !== null) {
      invariant(!replacementIds.has(replacesSliceId), 'ATLAS_REMAP_NOT_ONE_TO_ONE', 'A prior slice may be mapped to only one replacement rectangle.', { replacesSliceId });
      replacementIds.add(replacesSliceId);
    }

    const normalizedRectangle = {
      rectangleId,
      x,
      y,
      width,
      height,
      included: candidate.included,
      pivot,
      transparentPaddingPolicy: TRANSPARENT_PADDING_POLICY,
      replacesSliceId,
      expectedSliceVersion,
    };
    if (candidate.included) {
      const geometry = `${x}:${y}:${width}:${height}`;
      invariant(!geometries.has(geometry), 'ATLAS_RECT_DUPLICATE', 'Included rectangles must not duplicate exact geometry.', { rectangleId });
      geometries.add(geometry);
      const pixels = width * height;
      invariant(Number.isSafeInteger(pixels) && totalOutputPixels <= maxOutputPixels - pixels, 'ATLAS_OUTPUT_LIMIT', 'Included rectangles exceed the bounded output-pixel budget.', { maxOutputPixels });
      const outputByteSize = canonicalRgbaPngByteSize(width, height);
      invariant(outputByteSize <= maxOutputBytes, 'ATLAS_OUTPUT_BYTES_LIMIT', 'A canonical slice PNG would exceed the per-artifact byte limit.', {
        rectangleId,
        outputByteSize,
        maxOutputBytes,
      });
      totalOutputPixels += pixels;
      invariant(totalOutputBytes <= Number.MAX_SAFE_INTEGER - outputByteSize, 'ATLAS_OUTPUT_LIMIT', 'Included rectangle byte accounting overflowed.');
      totalOutputBytes += outputByteSize;
      for (const prior of normalized) {
        invariant(!prior.included || !rectanglesOverlap(prior, normalizedRectangle), 'ATLAS_RECT_OVERLAP', 'Included rectangles must not overlap in Checkpoint 2B.', { rectangleId, overlapsRectangleId: prior.rectangleId });
      }
    }
    normalized.push(normalizedRectangle);
  }

  invariant(normalized.some((rectangle) => rectangle.included), 'ATLAS_RECT_INVALID', 'At least one rectangle must be included.');
  const fingerprintInput = {
    schemaVersion: 1,
    sourceWidth,
    sourceHeight,
    processorId: ATLAS_PROCESSOR_ID,
    rectangles: normalized,
  };
  return Object.freeze({
    schemaVersion: 1,
    processorId: ATLAS_PROCESSOR_ID,
    rectangles: structuredClone(normalized),
    includedCount: normalized.filter((rectangle) => rectangle.included).length,
    totalOutputPixels,
    totalOutputBytes,
    fingerprint: stableFingerprint(fingerprintInput),
  });
}

export function proposeRegularGrid({
  sourceWidth,
  sourceHeight,
  rows,
  columns,
  margins,
  gapX,
  gapY,
  rectangleIdPrefix = 'rect.grid',
}) {
  safeInteger(sourceWidth, 'sourceWidth', { min: 1 });
  safeInteger(sourceHeight, 'sourceHeight', { min: 1 });
  safeInteger(rows, 'rows', { min: 1, max: MAX_ATLAS_RECTANGLES });
  safeInteger(columns, 'columns', { min: 1, max: MAX_ATLAS_RECTANGLES });
  invariant(rows <= Math.floor(MAX_ATLAS_RECTANGLES / columns), 'ATLAS_RECT_LIMIT', `A regular grid may contain at most ${MAX_ATLAS_RECTANGLES} rectangles.`);
  invariant(margins && typeof margins === 'object' && !Array.isArray(margins), 'ATLAS_GRID_INVALID', 'Grid margins are required.');
  const top = safeInteger(margins.top, 'margins.top');
  const right = safeInteger(margins.right, 'margins.right');
  const bottom = safeInteger(margins.bottom, 'margins.bottom');
  const left = safeInteger(margins.left, 'margins.left');
  safeInteger(gapX, 'gapX');
  safeInteger(gapY, 'gapY');
  opaqueId(rectangleIdPrefix, 'rectangleIdPrefix');
  invariant(rectangleIdPrefix.length <= 122, 'ATLAS_GRID_INVALID', 'Grid rectangle ID prefix is too long for the largest generated row/column suffix.');

  const horizontalGaps = (columns - 1) * gapX;
  const verticalGaps = (rows - 1) * gapY;
  invariant(Number.isSafeInteger(horizontalGaps) && Number.isSafeInteger(verticalGaps), 'ATLAS_GRID_INVALID', 'Grid gap arithmetic overflowed.');
  const availableWidth = sourceWidth - left - right - horizontalGaps;
  const availableHeight = sourceHeight - top - bottom - verticalGaps;
  invariant(Number.isSafeInteger(availableWidth) && Number.isSafeInteger(availableHeight), 'ATLAS_GRID_INVALID', 'Grid area arithmetic overflowed.');
  const findings = [];
  if (availableWidth <= 0 || availableHeight <= 0) {
    findings.push({ code: 'studio.atlas.grid.no_space', severity: 'error', message: 'Margins and gaps leave no positive source area.' });
  }
  if (availableWidth > 0 && availableWidth % columns !== 0) {
    findings.push({ code: 'studio.atlas.grid.width_remainder', severity: 'error', message: `${availableWidth % columns} horizontal source pixel(s) remain undistributed.` });
  }
  if (availableHeight > 0 && availableHeight % rows !== 0) {
    findings.push({ code: 'studio.atlas.grid.height_remainder', severity: 'error', message: `${availableHeight % rows} vertical source pixel(s) remain undistributed.` });
  }
  if (findings.length > 0) {
    return Object.freeze({ schemaVersion: 1, authoritative: false, rectangles: [], findings });
  }

  const width = availableWidth / columns;
  const height = availableHeight / rows;
  const rectangles = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      rectangles.push({
        rectangleId: `${rectangleIdPrefix}.${row}.${column}`,
        x: left + column * (width + gapX),
        y: top + row * (height + gapY),
        width,
        height,
        included: true,
        pivot: null,
        transparentPaddingPolicy: TRANSPARENT_PADDING_POLICY,
        replacesSliceId: null,
        expectedSliceVersion: null,
      });
    }
  }
  const validated = validateAtlasRectangles(rectangles, { sourceWidth, sourceHeight });
  return Object.freeze({
    schemaVersion: 1,
    authoritative: false,
    sourceWidth,
    sourceHeight,
    rows,
    columns,
    margins: { top, right, bottom, left },
    gapX,
    gapY,
    cellWidth: width,
    cellHeight: height,
    rectangles: validated.rectangles,
    fingerprint: validated.fingerprint,
    findings: [],
  });
}
