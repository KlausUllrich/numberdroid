import { invariant } from './errors.js';

// Portable physical geometry. No DOM, I/O, runtime imports or pixel approximation.
export const ASSET_SPATIAL_SCHEMA_VERSION = 1;
export const MAX_BLOCKING_REGIONS = 16;
export const MAX_POLYGON_POINTS = 64;
const LIMIT = 65535;
const coordinate = { type: 'number', minimum: -LIMIT, maximum: LIMIT };
const dimension = { type: 'number', exclusiveMinimum: 0, maximum: LIMIT };
const pointSchema = { type: 'object', additionalProperties: false, required: ['x', 'y'], properties: { x: coordinate, y: coordinate } };
const rectangleProperties = { x: coordinate, y: coordinate, width: dimension, height: dimension };
const rectangleSchema = { type: 'object', additionalProperties: false, required: ['x', 'y', 'width', 'height'], properties: rectangleProperties };
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export const ASSET_SPATIAL_SCHEMA = freeze({
  type: 'object', additionalProperties: false,
  required: ['schemaVersion', 'coordinateSpace', 'unitsPerPixel', 'placementBounds', 'anchor', 'blockingRegions'],
  properties: {
    schemaVersion: { type: 'integer', const: 1 }, coordinateSpace: { type: 'string', const: 'image-pixels' },
    unitsPerPixel: { type: 'object', additionalProperties: false, required: ['x', 'y'], properties: {
      x: { type: 'number', minimum: 0.000001, maximum: 64 }, y: { type: 'number', minimum: 0.000001, maximum: 64 },
    } },
    placementBounds: rectangleSchema, anchor: pointSchema,
    blockingRegions: { type: 'array', maxItems: MAX_BLOCKING_REGIONS, items: {
      type: 'object', additionalProperties: false, required: ['regionId', 'name', 'shape'], properties: {
        regionId: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' },
        name: { type: 'string', minLength: 1, maxLength: 160 },
        shape: { oneOf: [
          ...['rectangle', 'oval'].map((kind) => ({ type: 'object', additionalProperties: false, required: ['kind', 'x', 'y', 'width', 'height'], properties: { kind: { type: 'string', const: kind }, ...rectangleProperties } })),
          { type: 'object', additionalProperties: false, required: ['kind', 'points'], properties: { kind: { type: 'string', const: 'polygon' }, points: { type: 'array', minItems: 3, maxItems: MAX_POLYGON_POINTS, items: pointSchema } } },
        ] },
      },
    } },
  },
});

function fail(condition, field, message, code = 'ASSET_SPATIAL_INVALID') {
  invariant(condition, code, `${field}: ${message}`, { field });
}
function record(value, keys, path) {
  fail(value !== null && typeof value === 'object' && !Array.isArray(value), path, 'Provide an object with the documented geometry fields.');
  for (const key of Reflect.ownKeys(value)) fail(typeof key === 'string' && keys.includes(key), `${path}.${String(key)}`, 'Remove this unsupported field.');
  for (const key of keys) fail(Object.hasOwn(value, key), `${path}.${key}`, 'Provide this required field.');
  return value;
}
function number(value, path, { min = -LIMIT, max = LIMIT, positive = false } = {}) {
  fail(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && (!positive || value > 0), path, `Use a finite ${positive ? 'positive ' : ''}number from ${min} to ${max}.`);
  return value === 0 ? 0 : value;
}
function text(value, path, max = 160) {
  fail(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max, path, `Use a nonblank name of at most ${max} characters.`);
  return value.trim();
}
function point(value, path) {
  const p = record(value, ['x', 'y'], path); return { x: number(p.x, `${path}.x`), y: number(p.y, `${path}.y`) };
}
function rect(value, path) {
  const r = record(value, ['x', 'y', 'width', 'height'], path);
  return { x: number(r.x, `${path}.x`), y: number(r.y, `${path}.y`), width: number(r.width, `${path}.width`, { min: 0, positive: true }), height: number(r.height, `${path}.height`, { min: 0, positive: true }) };
}
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const samePoint = (a, b) => a.x === b.x && a.y === b.y;
function onSegment(a, b, p) {
  return cross(a, b, p) === 0 && p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x) && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y);
}
function segmentsMeet(a, b, c, d) {
  const ac = cross(a, b, c); const ad = cross(a, b, d); const ca = cross(c, d, a); const cb = cross(c, d, b);
  return (Math.sign(ac) !== Math.sign(ad) && ac !== 0 && ad !== 0 && Math.sign(ca) !== Math.sign(cb) && ca !== 0 && cb !== 0)
    || onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}
function twiceArea(points) {
  if (points.length < 3) return 0;
  let area = 0; const origin = points[0];
  for (let i = 1; i + 1 < points.length; i += 1) area += cross(origin, points[i], points[i + 1]);
  return area;
}
function normalizeShape(value, path) {
  fail(value && ['polygon', 'rectangle', 'oval'].includes(value.kind), `${path}.kind`, 'Choose polygon, rectangle or oval.');
  if (value.kind !== 'polygon') {
    record(value, ['kind', 'x', 'y', 'width', 'height'], path);
    return { kind: value.kind, ...rect({ x: value.x, y: value.y, width: value.width, height: value.height }, path) };
  }
  record(value, ['kind', 'points'], path);
  fail(Array.isArray(value.points) && value.points.length >= 3 && value.points.length <= MAX_POLYGON_POINTS, `${path}.points`, `Close the polygon with 3 to ${MAX_POLYGON_POINTS} distinct points.`);
  const points = Array.from(value.points, (p, i) => point(p, `${path}.points[${i}]`));
  for (let i = 0; i < points.length; i += 1) {
    fail(!points.slice(0, i).some((p) => samePoint(p, points[i])), `${path}.points[${i}]`, 'Remove the repeated point; the closing point is implicit.');
    const next = (i + 1) % points.length; const prior = (i + points.length - 1) % points.length;
    fail(!(cross(points[prior], points[i], points[next]) === 0 && onSegment(points[prior], points[i], points[next])), `${path}.points[${i}]`, 'Move this point so adjacent edges do not fold back over one another.');
    for (let j = i + 1; j < points.length; j += 1) {
      const after = (j + 1) % points.length;
      if (j === next || after === i) continue;
      fail(!segmentsMeet(points[i], points[next], points[j], points[after]), `${path}.points[${j}]`, 'Move this point so nonadjacent edges neither cross nor touch.');
    }
  }
  fail(twiceArea(points) !== 0, `${path}.points`, 'Move a point to give the closed polygon a nonzero area.');
  return { kind: 'polygon', points };
}

export function normalizeAssetSpatial(value, { path = 'metadata.spatial' } = {}) {
  const s = record(value, ['schemaVersion', 'coordinateSpace', 'unitsPerPixel', 'placementBounds', 'anchor', 'blockingRegions'], path);
  fail(s.schemaVersion === 1, `${path}.schemaVersion`, 'Use spatial schema version 1.');
  fail(s.coordinateSpace === 'image-pixels', `${path}.coordinateSpace`, 'Use image-pixels coordinates.');
  record(s.unitsPerPixel, ['x', 'y'], `${path}.unitsPerPixel`);
  const unitsPerPixel = Object.fromEntries(['x', 'y'].map((axis) => [axis, number(s.unitsPerPixel[axis], `${path}.unitsPerPixel.${axis}`, { min: 0.000001, max: 64 })]));
  const placementBounds = rect(s.placementBounds, `${path}.placementBounds`);
  for (const [dimensionName, axis] of [['width', 'x'], ['height', 'y']]) fail(placementBounds[dimensionName] * unitsPerPixel[axis] <= 64, `${path}.placementBounds.${dimensionName}`, 'Reduce the placement dimension or explicitly change its scale to stay within 64 project units.');
  fail(Array.isArray(s.blockingRegions) && s.blockingRegions.length <= MAX_BLOCKING_REGIONS, `${path}.blockingRegions`, `Use at most ${MAX_BLOCKING_REGIONS} blocking regions.`);
  const seen = new Set();
  const blockingRegions = Array.from(s.blockingRegions, (region, i) => {
    const regionPath = `${path}.blockingRegions[${i}]`; record(region, ['regionId', 'name', 'shape'], regionPath);
    const regionId = text(region.regionId, `${regionPath}.regionId`, 128);
    fail(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(regionId) && !seen.has(regionId), `${regionPath}.regionId`, 'Use a unique stable region identifier.'); seen.add(regionId);
    return { regionId, name: text(region.name, `${regionPath}.name`), shape: normalizeShape(region.shape, `${regionPath}.shape`) };
  });
  return { schemaVersion: 1, coordinateSpace: 'image-pixels', unitsPerPixel, placementBounds, anchor: point(s.anchor, `${path}.anchor`), blockingRegions };
}

export function spatialAliases(spatial) {
  const s = normalizeAssetSpatial(spatial);
  const spanTiles = { width: Math.ceil(s.placementBounds.width * s.unitsPerPixel.x), height: Math.ceil(s.placementBounds.height * s.unitsPerPixel.y) };
  const anchor = {
    x: Math.max(0, Math.min(spanTiles.width - 1, Math.floor((s.anchor.x - s.placementBounds.x) * s.unitsPerPixel.x))),
    y: Math.max(0, Math.min(spanTiles.height - 1, Math.floor((s.anchor.y - s.placementBounds.y) * s.unitsPerPixel.y))),
  };
  return { spanTiles, anchor, collision: { mode: 'spatial', bounds: null, parts: [] } };
}

export function validateSpatialAliases(metadata, spatial = metadata.spatial) {
  const expected = spatialAliases(spatial);
  for (const [field, keys] of [['spanTiles', ['width', 'height']], ['anchor', ['x', 'y']]]) {
    fail(metadata[field] !== null && typeof metadata[field] === 'object' && keys.every((key) => metadata[field][key] === expected[field][key]), `metadata.${field}`, `Use the derived spatial ${field}: ${JSON.stringify(expected[field])}.`, 'ASSET_SPATIAL_ALIAS_CONFLICT');
  }
  fail(metadata.collision?.mode === 'spatial' && metadata.collision.bounds === null && Array.isArray(metadata.collision.parts) && metadata.collision.parts.length === 0, 'metadata.collision', 'Use {mode:"spatial",bounds:null,parts:[]} so blocking has one authority.', 'ASSET_SPATIAL_ALIAS_CONFLICT');
  return expected;
}

export function shapeBounds(shape) {
  fail(shape && ['polygon', 'rectangle', 'oval'].includes(shape.kind), 'shape.kind', 'Use a supported exact shape.');
  if (shape.kind !== 'polygon') return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
  const xs = shape.points.map((p) => p.x); const ys = shape.points.map((p) => p.y);
  const x = Math.min(...xs); const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
const containsRect = (outer, inner) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
const rectIntersects = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

export function spatialMetadataFindings(spatial, { kind, navigation, extensions } = {}) {
  const s = normalizeAssetSpatial(spatial); const findings = [];
  const add = (ruleId, path, explanation, remediation) => findings.push({ ruleId, path, explanation, remediation, severity: 'ERROR' });
  s.blockingRegions.forEach((region, i) => {
    if (!containsRect(s.placementBounds, shapeBounds(region.shape))) add('studio.asset.spatial.blocking_out_of_bounds', `/spatial/blockingRegions/${i}/shape`, `Blocking region “${region.name}” exceeds the authored placement bounds.`, 'Enlarge the placement bounds or explicitly edit this region; its shape has been retained.');
  });
  if (kind === 'surface' && (!Number.isInteger(s.placementBounds.width * s.unitsPerPixel.x) || !Number.isInteger(s.placementBounds.height * s.unitsPerPixel.y))) add('studio.asset.spatial.surface_integral_required', '/spatial/placementBounds', 'A Surface macro requires whole project-unit dimensions.', 'Adjust the placement bounds or explicit scale to make both physical dimensions integral.');
  if (navigation?.effect === 'blocked' && s.blockingRegions.length === 0) add('studio.asset.spatial.blocking_required', '/spatial/blockingRegions', 'Blocked navigation has no authored blocking region.', 'Draw the intended blocking region or choose passable navigation; no footprint blocker is inferred.');
  if (extensions && Object.hasOwn(extensions, 'studio.preview.presentation')) add('studio.asset.spatial.presentation_conflict', '/extensions/studio.preview.presentation', 'Legacy preview presentation cannot override the spatial image, anchor or segments.', 'Explicitly resolve or remove the legacy presentation before using this spatial version.');
  return findings;
}

function imageSize(asset) {
  const size = asset.metadata?.pixelSize ?? { width: asset.sliceBinding?.width, height: asset.sliceBinding?.height };
  for (const key of ['width', 'height']) fail(Number.isInteger(size[key]) && size[key] >= 1 && size[key] <= LIMIT, `asset.pixelSize.${key}`, 'Resolve the exact saved image dimensions.');
  return size;
}

export function spatialFromLegacyAsset(asset) {
  if (Object.hasOwn(asset.metadata ?? {}, 'spatial')) return normalizeAssetSpatial(asset.metadata.spatial);
  const metadata = asset.metadata ?? {}; const size = imageSize(asset); const span = metadata.spanTiles;
  fail(Number.isInteger(span?.width) && span.width > 0 && Number.isInteger(span?.height) && span.height > 0, 'metadata.spanTiles', 'Complete the legacy footprint before explicit conversion.');
  const unitsPerPixel = { x: span.width / size.width, y: span.height / size.height };
  const collision = metadata.collision;
  const oldRects = collision?.mode === 'bounds' ? [collision.bounds] : collision?.mode === 'parts' ? collision.parts : [];
  const rectangles = oldRects.length > 0 ? oldRects : metadata.navigation?.effect === 'blocked' ? [{ x: 0, y: 0, width: span.width, height: span.height }] : [];
  const anchor = metadata.anchor ? { x: metadata.anchor.x + 0.5, y: metadata.anchor.y + 0.5 } : { x: span.width / 2, y: span.height };
  return normalizeAssetSpatial({ schemaVersion: 1, coordinateSpace: 'image-pixels', unitsPerPixel,
    placementBounds: { x: 0, y: 0, width: size.width, height: size.height }, anchor: { x: anchor.x / unitsPerPixel.x, y: anchor.y / unitsPerPixel.y },
    blockingRegions: rectangles.map((r, i) => ({ regionId: `region.${i + 1}`, name: `Blocking ${i + 1}`, shape: { kind: 'rectangle', x: r.x / unitsPerPixel.x, y: r.y / unitsPerPixel.y, width: r.width / unitsPerPixel.x, height: r.height / unitsPerPixel.y } })),
  });
}

function mapShape(shape, mapPoint, scale) {
  if (shape.kind === 'polygon') return { kind: 'polygon', points: shape.points.map(mapPoint) };
  return { kind: shape.kind, ...mapPoint(shape), width: shape.width * scale.x, height: shape.height * scale.y };
}

export function resolveAssetSpatialGeometry(asset) {
  const metadata = asset.metadata ?? {};
  if (!Object.hasOwn(metadata, 'spatial')) {
    const span = metadata.spanTiles;
    fail(Number.isInteger(span?.width) && span.width >= 1 && span.width <= 64 && Number.isInteger(span?.height) && span.height >= 1 && span.height <= 64, 'metadata.spanTiles', 'Resolve an authored legacy footprint.');
    const collision = metadata.collision;
    const rects = collision?.mode === 'bounds' && collision.bounds ? [collision.bounds] : collision?.mode === 'parts' ? collision.parts ?? [] : [];
    const effective = rects.length === 0 && metadata.navigation?.effect === 'blocked' ? [{ x: 0, y: 0, ...span }] : rects;
    return { spatial: false, placementBounds: { x: 0, y: 0, ...span }, imageBounds: { x: 0, y: 0, ...span }, anchor: metadata.anchor ? { x: metadata.anchor.x + 0.5, y: metadata.anchor.y + 0.5 } : { x: span.width / 2, y: span.height }, regions: effective.map((r, i) => ({ regionId: `legacy.${i}`, name: `Blocking ${i + 1}`, shape: { kind: 'rectangle', ...r } })), occupancy: { ...span }, findings: [] };
  }
  const s = normalizeAssetSpatial(metadata.spatial); const aliases = validateSpatialAliases(metadata, s); const size = imageSize(asset);
  const mapPoint = (p) => ({ x: (p.x - s.placementBounds.x) * s.unitsPerPixel.x, y: (p.y - s.placementBounds.y) * s.unitsPerPixel.y });
  return {
    spatial: true,
    placementBounds: { x: 0, y: 0, width: s.placementBounds.width * s.unitsPerPixel.x, height: s.placementBounds.height * s.unitsPerPixel.y },
    imageBounds: { ...mapPoint({ x: 0, y: 0 }), width: size.width * s.unitsPerPixel.x, height: size.height * s.unitsPerPixel.y },
    anchor: mapPoint(s.anchor), regions: s.blockingRegions.map((region) => ({ ...region, shape: mapShape(region.shape, mapPoint, s.unitsPerPixel) })),
    occupancy: aliases.spanTiles, findings: spatialMetadataFindings(s, { kind: asset.kind, navigation: metadata.navigation, extensions: metadata.extensions }),
  };
}

function rotatedPoint(p, bounds, rotation) {
  if (rotation === 0) return { x: p.x, y: p.y };
  if (rotation === 90) return { x: bounds.height - p.y, y: p.x };
  if (rotation === 180) return { x: bounds.width - p.x, y: bounds.height - p.y };
  return { x: p.y, y: bounds.width - p.x };
}
function rotatedRect(r, bounds, rotation) {
  if (rotation === 0) return { ...r };
  if (rotation === 90) return { x: bounds.height - r.y - r.height, y: r.x, width: r.height, height: r.width };
  if (rotation === 180) return { x: bounds.width - r.x - r.width, y: bounds.height - r.y - r.height, width: r.width, height: r.height };
  return { x: r.y, y: bounds.width - r.x - r.width, width: r.height, height: r.width };
}

export function transformAssetSpatialGeometry(geometry, { origin = { x: 0, y: 0 }, rotation = 0 } = {}) {
  fail([0, 90, 180, 270].includes(rotation), 'rotation', 'Use a cardinal rotation; arbitrary rotation and shear are unsupported.');
  fail(Number.isFinite(origin.x) && Number.isFinite(origin.y), 'origin', 'Use finite placement coordinates.');
  const mapPoint = (p) => { const r = rotatedPoint(p, geometry.placementBounds, rotation); return { x: r.x + origin.x, y: r.y + origin.y }; };
  const mapRect = (r) => { const value = rotatedRect(r, geometry.placementBounds, rotation); return { ...value, x: value.x + origin.x, y: value.y + origin.y }; };
  const quarter = rotation === 90 || rotation === 270;
  return { ...geometry, placementBounds: mapRect(geometry.placementBounds), imageBounds: mapRect(geometry.imageBounds), anchor: mapPoint(geometry.anchor), occupancy: quarter ? { width: geometry.occupancy.height, height: geometry.occupancy.width } : { ...geometry.occupancy }, regions: geometry.regions.map((region) => ({ ...region, shape: region.shape.kind === 'polygon' ? { kind: 'polygon', points: region.shape.points.map(mapPoint) } : { kind: region.shape.kind, ...mapRect(shapeBounds(region.shape)) } })) };
}

function clipPolygon(points, axis, boundary, keepGreater) {
  const output = [];
  const inside = (p) => keepGreater ? p[axis] >= boundary : p[axis] <= boundary;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]; const b = points[(i + 1) % points.length]; const aIn = inside(a); const bIn = inside(b);
    if (aIn) output.push(a);
    if (aIn !== bIn) {
      const t = (boundary - a[axis]) / (b[axis] - a[axis]);
      output.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y), [axis]: boundary });
    }
  }
  return output;
}

export function shapeIntersectsRect(shape, rectangle) {
  for (const field of ['x', 'y', 'width', 'height']) fail(Number.isFinite(rectangle?.[field]), `rectangle.${field}`, 'Use finite rectangle coordinates.');
  fail(rectangle.width > 0 && rectangle.height > 0, 'rectangle', 'Use positive rectangle dimensions.');
  const bounds = shapeBounds(shape);
  if (!rectIntersects(bounds, rectangle)) return false;
  if (shape.kind === 'rectangle') return true;
  if (shape.kind === 'oval') {
    const rx = shape.width / 2; const ry = shape.height / 2; const cx = shape.x + rx; const cy = shape.y + ry;
    const nearestX = Math.max(rectangle.x, Math.min(cx, rectangle.x + rectangle.width));
    const nearestY = Math.max(rectangle.y, Math.min(cy, rectangle.y + rectangle.height));
    return ((nearestX - cx) / rx) ** 2 + ((nearestY - cy) / ry) ** 2 < 1;
  }
  let clipped = shape.points;
  for (const [axis, boundary, keepGreater] of [['x', rectangle.x, true], ['x', rectangle.x + rectangle.width, false], ['y', rectangle.y, true], ['y', rectangle.y + rectangle.height, false]]) {
    clipped = clipPolygon(clipped, axis, boundary, keepGreater); if (clipped.length < 3) return false;
  }
  return Math.abs(twiceArea(clipped)) > 0;
}

export function classifyBlockingPair(left, right) {
  if (!rectIntersects(shapeBounds(left), shapeBounds(right))) return 'DISJOINT';
  if (left.kind === 'rectangle') return shapeIntersectsRect(right, shapeBounds(left)) ? 'INTERSECTS' : 'DISJOINT';
  if (right.kind === 'rectangle') return shapeIntersectsRect(left, shapeBounds(right)) ? 'INTERSECTS' : 'DISJOINT';
  return 'UNSUPPORTED';
}

export function blockingCells(geometry, roomBounds) {
  fail(geometry.findings.every((finding) => finding.severity !== 'ERROR'), 'geometry', 'Correct spatial findings before computing Room navigation.');
  const { x = 0, y = 0, width, height } = roomBounds;
  fail([x, y, width, height].every(Number.isInteger) && width > 0 && height > 0 && width <= 64 && height <= 64, 'roomBounds', 'Use bounded integer Room dimensions.');
  const occupied = new Set();
  for (const { shape } of geometry.regions) {
    const b = shapeBounds(shape);
    for (let cy = Math.max(y, Math.floor(b.y)); cy < Math.min(y + height, Math.ceil(b.y + b.height)); cy += 1) {
      for (let cx = Math.max(x, Math.floor(b.x)); cx < Math.min(x + width, Math.ceil(b.x + b.width)); cx += 1) {
        if (shapeIntersectsRect(shape, { x: cx, y: cy, width: 1, height: 1 })) occupied.add(`${cx},${cy}`);
      }
    }
  }
  return [...occupied].map((key) => { const [cx, cy] = key.split(',').map(Number); return { x: cx, y: cy }; }).sort((a, b) => a.y - b.y || a.x - b.x);
}
