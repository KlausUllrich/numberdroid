import { invariant } from './errors.js';
import { ASSET_SPATIAL_SCHEMA, normalizeAssetSpatial, resolveAssetSpatialGeometry } from './asset-spatial-geometry.js';

// Portable composition only. No rasterization, storage, URLs or Room semantics.
export const ASSEMBLY_SCHEMA_VERSION = 1;
export const ASSEMBLY_MAX_COMPONENTS = 32;
export const ASSEMBLY_MAX_CUSTOM_REGIONS = 512;
export const ASSEMBLY_MAX_BYTES = 256 * 1024;
export const ASSEMBLY_SCENE_LIMIT = 1000000;
export const ASSEMBLY_ID_PATTERN = '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$';
export const ASSEMBLY_IDENTITY_MATRIX = Object.freeze([1, 0, 0, 1, 0, 0]);
const ID = new RegExp(ASSEMBLY_ID_PATTERN);
const LIMIT = 65535;
const coordinateSchema = { type: 'number', minimum: -LIMIT, maximum: LIMIT };
const dimensionSchema = { type: 'number', exclusiveMinimum: 0, maximum: LIMIT };
const idSchema = { type: 'string', minLength: 1, maxLength: 128, pattern: ASSEMBLY_ID_PATTERN };
const nameSchema = { type: 'string', minLength: 1, maxLength: 160 };
function objectSchema(properties) { return { type: 'object', additionalProperties: false, required: Object.keys(properties), properties }; }
function arraySchema(items, maxItems, minItems = 0) { return { type: 'array', minItems, maxItems, items }; }
function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
const pointSchema = objectSchema({ x: coordinateSchema, y: coordinateSchema });
const boundsSchema = objectSchema({ x: coordinateSchema, y: coordinateSchema, width: dimensionSchema, height: dimensionSchema });
export const ASSEMBLY_PIN_SCHEMA = freeze(objectSchema({ assetId: idSchema, assetVersion: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER }, metadataVersion: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER } }));
export const ASSEMBLY_REGION_SCHEMA = freeze(objectSchema({ regionId: idSchema, name: nameSchema, shape: ASSET_SPATIAL_SCHEMA.properties.blockingRegions.items.properties.shape, transform: arraySchema(coordinateSchema, 6, 6) }));
export const ASSEMBLY_DECLARATION_SCHEMA = freeze(objectSchema({
  schemaVersion: { type: 'integer', const: 1 }, coordinateSpace: { type: 'string', const: 'assembly-pixels' },
  unitsPerPixel: { type: 'number', minimum: 0.000001, maximum: 64, default: 1 / 64 }, placementBounds: boundsSchema, anchor: pointSchema,
  states: arraySchema(objectSchema({ stateId: idSchema, name: nameSchema }), 16, 1), variants: arraySchema(objectSchema({ variantId: idSchema, name: nameSchema }), 16, 1),
  defaultStateId: idSchema, defaultVariantId: idSchema,
  components: arraySchema(objectSchema({
    componentId: idSchema, name: nameSchema, asset: ASSEMBLY_PIN_SCHEMA, position: pointSchema,
    rotationDegrees: { type: 'number', minimum: -360000, maximum: 360000 }, scale: { type: 'number', minimum: 0.001, maximum: 1000 },
    stateIds: { oneOf: [{ type: 'null' }, { ...arraySchema(idSchema, 16), uniqueItems: true }] },
    variantOverrides: arraySchema(objectSchema({ variantId: idSchema, asset: ASSEMBLY_PIN_SCHEMA }), 16),
  }), ASSEMBLY_MAX_COMPONENTS, 1),
  blocking: objectSchema({ mode: { type: 'string', enum: ['components', 'custom'] }, regions: arraySchema(ASSEMBLY_REGION_SCHEMA, ASSEMBLY_MAX_CUSTOM_REGIONS) }),
}));
const clean = (value) => value === 0 ? 0 : value;
function normalizedRotation(value) { const remainder = value % 360; return clean(remainder < 0 ? remainder + 360 : remainder); }
function fail(condition, field, message, code = 'ASSEMBLY_INVALID') {
  invariant(condition, code, `${field}: ${message}`, { field });
}
function record(value, keys, field) {
  fail(value && typeof value === 'object' && !Array.isArray(value), field, 'Provide the documented object.');
  for (const key of Reflect.ownKeys(value)) fail(typeof key === 'string' && keys.includes(key), `${field}.${String(key)}`, 'Remove this unsupported field.');
  for (const key of keys) fail(Object.hasOwn(value, key), `${field}.${key}`, 'Provide this required field.');
  return value;
}
function numeric(value, field, min = -LIMIT, max = LIMIT, positive = false) {
  fail(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && (!positive || value > 0), field, `Use a finite ${positive ? 'positive ' : ''}number from ${min} to ${max}.`);
  return clean(value);
}
function string(value, field, max = 160) {
  fail(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max, field, `Use a nonblank string of at most ${max} characters.`);
  return value.trim();
}
function id(value, field) { const result = string(value, field, 128); fail(ID.test(result), field, 'Use a stable repository identifier.'); return result; }
function list(value, field, max, min = 0) {
  fail(Array.isArray(value) && value.length >= min && value.length <= max, field, `Use ${min} to ${max} entries.`);
  for (let i = 0; i < value.length; i += 1) fail(Object.hasOwn(value, i), `${field}[${i}]`, 'Provide an entry; sparse arrays are unsupported.');
  return value;
}
function point(value, field) { record(value, ['x', 'y'], field); return { x: numeric(value.x, `${field}.x`), y: numeric(value.y, `${field}.y`) }; }
function rectangle(value, field) {
  record(value, ['x', 'y', 'width', 'height'], field);
  return { x: numeric(value.x, `${field}.x`), y: numeric(value.y, `${field}.y`), width: numeric(value.width, `${field}.width`, 0, LIMIT, true), height: numeric(value.height, `${field}.height`, 0, LIMIT, true) };
}
export function normalizeAssemblyPin(value, field = 'asset') {
  record(value, ['assetId', 'assetVersion', 'metadataVersion'], field);
  const pin = { assetId: id(value.assetId, `${field}.assetId`) };
  for (const key of ['assetVersion', 'metadataVersion']) {
    fail(Number.isSafeInteger(value[key]) && value[key] > 0, `${field}.${key}`, 'Use a positive safe version integer.'); pin[key] = value[key];
  }
  return pin;
}
export function assemblyAssetKey(pin) { return `${pin.assetId}@${pin.assetVersion}:${pin.metadataVersion}`; }
function choices(value, key, field) {
  const seen = new Set();
  return list(value, field, 16, 1).map((entry, index) => {
    const path = `${field}[${index}]`; record(entry, [key, 'name'], path);
    const choiceId = id(entry[key], `${path}.${key}`);
    fail(!seen.has(choiceId), `${path}.${key}`, 'Use a unique choice identifier.'); seen.add(choiceId);
    return { [key]: choiceId, name: string(entry.name, `${path}.name`) };
  });
}

export function normalizeAssemblyTransform(value, field = 'transform') {
  list(value, field, 6, 6);
  const matrix = value.map((v, index) => numeric(v, `${field}[${index}]`, index < 4 ? -1 : -LIMIT, index < 4 ? 1 : LIMIT));
  const [a, b, c, d] = matrix; const tolerance = 32 * Number.EPSILON;
  fail(Math.abs(a * a + b * b - 1) <= tolerance && Math.abs(c * c + d * d - 1) <= tolerance
    && Math.abs(a * c + b * d) <= tolerance && Math.abs(a * d - b * c - 1) <= tolerance,
  field, 'Use a proper rotation and translation; absorb positive uniform scale into the shape dimensions. Reflection, shear and extra scale are unsupported.');
  return matrix;
}

export function normalizeAssemblyRegions(value, field = 'assembly.blocking.regions') {
  const seen = new Set();
  return list(value, field, ASSEMBLY_MAX_CUSTOM_REGIONS).map((entry, index) => {
    const path = `${field}[${index}]`; record(entry, ['regionId', 'name', 'shape', 'transform'], path);
    const regionId = id(entry.regionId, `${path}.regionId`);
    fail(!seen.has(regionId), `${path}.regionId`, 'Use a unique region identifier.'); seen.add(regionId);
    const name = string(entry.name, `${path}.name`);
    // Reuse the accepted exact topology validator without changing its schema.
    let spatial;
    try {
      spatial = normalizeAssetSpatial({ schemaVersion: 1, coordinateSpace: 'image-pixels', unitsPerPixel: { x: 0.000001, y: 0.000001 }, placementBounds: { x: 0, y: 0, width: 1, height: 1 }, anchor: { x: 0, y: 0 }, blockingRegions: [{ regionId, name, shape: entry.shape }] }, { path });
    } catch (error) {
      if (!error.details?.field) throw error;
      const field = error.details.field.replace(`${path}.blockingRegions[0]`, path);
      fail(false, field, error.message.replace(`${error.details.field}: `, ''));
    }
    const transform = normalizeAssemblyTransform(entry.transform, `${path}.transform`);
    let shape = spatial.blockingRegions[0].shape;
    if (shape.kind === 'polygon') {
      shape = { kind: 'polygon', points: shape.points.map((p) => {
        const mapped = transformAssemblyPoint(p, transform); return point(mapped, `${path}.shape.points`);
      }) };
      return { regionId, name, shape, transform: [...ASSEMBLY_IDENTITY_MATRIX] };
    }
    return { regionId, name, shape, transform };
  });
}

export function normalizeAssemblyDeclaration(value) {
  const field = 'assembly';
  record(value, ['schemaVersion', 'coordinateSpace', 'unitsPerPixel', 'placementBounds', 'anchor', 'states', 'variants', 'defaultStateId', 'defaultVariantId', 'components', 'blocking'], field);
  fail(value.schemaVersion === 1, `${field}.schemaVersion`, 'Use schema version 1.');
  fail(value.coordinateSpace === 'assembly-pixels', `${field}.coordinateSpace`, 'Use assembly-pixels coordinates.');
  const unitsPerPixel = numeric(value.unitsPerPixel, `${field}.unitsPerPixel`, 0.000001, 64, true);
  const placementBounds = rectangle(value.placementBounds, `${field}.placementBounds`);
  for (const key of ['width', 'height']) fail(placementBounds[key] * unitsPerPixel <= 64, `${field}.placementBounds.${key}`, 'Keep physical placement dimensions within 64 project units.');
  const states = choices(value.states, 'stateId', `${field}.states`); const stateIds = new Set(states.map((entry) => entry.stateId));
  const variants = choices(value.variants, 'variantId', `${field}.variants`); const variantIds = new Set(variants.map((entry) => entry.variantId));
  const defaultStateId = id(value.defaultStateId, `${field}.defaultStateId`); const defaultVariantId = id(value.defaultVariantId, `${field}.defaultVariantId`);
  fail(stateIds.has(defaultStateId), `${field}.defaultStateId`, 'Select a declared state.');
  fail(variantIds.has(defaultVariantId), `${field}.defaultVariantId`, 'Select a declared variant.');
  const componentIds = new Set();
  const components = list(value.components, `${field}.components`, ASSEMBLY_MAX_COMPONENTS, 1).map((entry, index) => {
    const path = `${field}.components[${index}]`;
    record(entry, ['componentId', 'name', 'asset', 'position', 'rotationDegrees', 'scale', 'stateIds', 'variantOverrides'], path);
    const componentId = id(entry.componentId, `${path}.componentId`);
    fail(!componentIds.has(componentId), `${path}.componentId`, 'Use a unique component identifier.'); componentIds.add(componentId);
    const memberIds = entry.stateIds === null ? null : list(entry.stateIds, `${path}.stateIds`, 16).map((v, i) => id(v, `${path}.stateIds[${i}]`));
    if (memberIds !== null) fail(new Set(memberIds).size === memberIds.length && memberIds.every((v) => stateIds.has(v)), `${path}.stateIds`, 'Use distinct declared state IDs, null for all states, or an empty array for none.');
    const overrideIds = new Set();
    const variantOverrides = list(entry.variantOverrides, `${path}.variantOverrides`, 16).map((override, i) => {
      const label = `${path}.variantOverrides[${i}]`; record(override, ['variantId', 'asset'], label);
      const variantId = id(override.variantId, `${label}.variantId`);
      fail(variantIds.has(variantId) && !overrideIds.has(variantId), `${label}.variantId`, 'Use a unique declared variant ID.'); overrideIds.add(variantId);
      return { variantId, asset: normalizeAssemblyPin(override.asset, `${label}.asset`) };
    });
    const rotation = numeric(entry.rotationDegrees, `${path}.rotationDegrees`, -360000, 360000);
    return { componentId, name: string(entry.name, `${path}.name`), asset: normalizeAssemblyPin(entry.asset, `${path}.asset`), position: point(entry.position, `${path}.position`), rotationDegrees: normalizedRotation(rotation), scale: numeric(entry.scale, `${path}.scale`, 0.001, 1000), stateIds: memberIds, variantOverrides };
  });
  record(value.blocking, ['mode', 'regions'], `${field}.blocking`);
  fail(['components', 'custom'].includes(value.blocking.mode), `${field}.blocking.mode`, 'Choose components or custom.');
  const assembly = { schemaVersion: 1, coordinateSpace: 'assembly-pixels', unitsPerPixel, placementBounds, anchor: point(value.anchor, `${field}.anchor`), states, variants, defaultStateId, defaultVariantId, components, blocking: { mode: value.blocking.mode, regions: normalizeAssemblyRegions(value.blocking.regions) } };
  fail(new TextEncoder().encode(JSON.stringify(assembly)).byteLength <= ASSEMBLY_MAX_BYTES, field, 'Reduce the declaration to at most 256 KiB.');
  return assembly;
}

export function transformAssemblyPoint(pointValue, matrix) {
  const [a, b, c, d, e, f] = matrix;
  return { x: clean(a * pointValue.x + c * pointValue.y + e), y: clean(b * pointValue.x + d * pointValue.y + f) };
}
export function inverseAssemblyPoint(pointValue, matrix) {
  const [a, b, c, d, e, f] = matrix; const determinant = a * d - b * c;
  fail(Number.isFinite(determinant) && determinant !== 0, 'transform', 'Use an invertible finite transform.');
  const x = pointValue.x - e; const y = pointValue.y - f;
  return { x: clean((d * x - c * y) / determinant), y: clean((-b * x + a * y) / determinant) };
}
export function multiplyAssemblyMatrices(left, right) {
  const [a, b, c, d, e, f] = left; const [g, h, i, j, k, l] = right;
  return [a * g + c * h, b * g + d * h, a * i + c * j, b * i + d * j, a * k + c * l + e, b * k + d * l + f].map(clean);
}
function rotationPair(degrees) {
  const rotation = normalizedRotation(degrees);
  if (rotation === 0) return [1, 0]; if (rotation === 90) return [0, 1]; if (rotation === 180) return [-1, 0]; if (rotation === 270) return [0, -1];
  return [Math.cos(rotation * Math.PI / 180), Math.sin(rotation * Math.PI / 180)];
}
export function assemblyComponentMatrix(component, anchor, unitsPerPixel) {
  const [cos, sin] = rotationPair(component.rotationDegrees); const scale = component.scale / unitsPerPixel;
  const a = cos * scale; const b = sin * scale; const c = -sin * scale; const d = cos * scale;
  return [a, b, c, d, component.position.x - a * anchor.x - c * anchor.y, component.position.y - b * anchor.x - d * anchor.y].map(clean);
}
function pointsBounds(points) {
  const x = Math.min(...points.map((p) => p.x)); const y = Math.min(...points.map((p) => p.y));
  return { x, y, width: Math.max(...points.map((p) => p.x)) - x, height: Math.max(...points.map((p) => p.y)) - y };
}
function rectPoints(rect) { return [{ x: rect.x, y: rect.y }, { x: rect.x + rect.width, y: rect.y }, { x: rect.x + rect.width, y: rect.y + rect.height }, { x: rect.x, y: rect.y + rect.height }]; }
export function assemblyShapeBounds(region) {
  const { shape, transform = ASSEMBLY_IDENTITY_MATRIX } = region;
  if (shape.kind === 'oval') {
    const center = transformAssemblyPoint({ x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 }, transform);
    const [a, b, c, d] = transform; const rx = shape.width / 2; const ry = shape.height / 2;
    const halfWidth = Math.hypot(a * rx, c * ry); const halfHeight = Math.hypot(b * rx, d * ry);
    return { x: center.x - halfWidth, y: center.y - halfHeight, width: 2 * halfWidth, height: 2 * halfHeight };
  }
  fail(['rectangle', 'polygon'].includes(shape.kind), 'shape.kind', 'Use a supported exact shape.');
  return pointsBounds((shape.kind === 'polygon' ? shape.points : rectPoints(shape)).map((p) => transformAssemblyPoint(p, transform)));
}
export function assemblyShapeContained(region, bounds) {
  const inner = assemblyShapeBounds(region);
  const tolerance = 16 * Number.EPSILON * Math.max(1, Math.abs(bounds.x), Math.abs(bounds.y), bounds.width, bounds.height, Math.abs(inner.x), Math.abs(inner.y), inner.width, inner.height);
  return inner.x >= bounds.x - tolerance && inner.y >= bounds.y - tolerance && inner.x + inner.width <= bounds.x + bounds.width + tolerance && inner.y + inner.height <= bounds.y + bounds.height + tolerance;
}
function boundedSceneRect(bounds, field) {
  for (const [key, value] of Object.entries(bounds)) numeric(value, `${field}.${key}`, key === 'width' || key === 'height' ? 0 : -ASSEMBLY_SCENE_LIMIT, ASSEMBLY_SCENE_LIMIT);
  fail(Math.abs(bounds.x + bounds.width) <= ASSEMBLY_SCENE_LIMIT && Math.abs(bounds.y + bounds.height) <= ASSEMBLY_SCENE_LIMIT, field, 'Keep resolved coordinates and spans within 1,000,000 assembly pixels.', 'ASSEMBLY_SCENE_LIMIT');
  return bounds;
}
function unionBounds(bounds) {
  const x = Math.min(...bounds.map((b) => b.x)); const y = Math.min(...bounds.map((b) => b.y));
  return boundedSceneRect({ x, y, width: Math.max(...bounds.map((b) => b.x + b.width)) - x, height: Math.max(...bounds.map((b) => b.y + b.height)) - y }, 'scene.bounds');
}
function assetMap(assets) {
  const values = assets instanceof Map ? [...assets.values()] : assets;
  fail(Array.isArray(values) && values.length <= ASSEMBLY_MAX_COMPONENTS * 17, 'assets', 'Provide the bounded exact native Asset closure.');
  const result = new Map();
  for (const asset of values) {
    fail(asset && typeof asset === 'object', 'assets', 'Provide exact native Asset records.');
    const key = assemblyAssetKey(asset); fail(!result.has(key), 'assets', 'Resolve each exact Asset version only once.', 'ASSEMBLY_ASSET_DUPLICATE'); result.set(key, asset);
  }
  return result;
}
function resolvedLeaf(pin, assets, projectId, cache) {
  const key = assemblyAssetKey(pin); if (cache.has(key)) return cache.get(key);
  const asset = assets.get(key);
  fail(asset, `assets.${key}`, 'Resolve the exact saved Asset/version/metadata pin; no latest-version substitution is permitted.', 'ASSEMBLY_ASSET_NOT_FOUND');
  fail(!Object.hasOwn(asset, 'assembly') && (!asset.contentKind || ['image', 'leaf', 'png', 'single-slice'].includes(asset.contentKind)), `assets.${key}`, 'Select a native single-slice PNG Asset; nesting and other content are unsupported.', 'ASSEMBLY_COMPONENT_UNSUPPORTED');
  const binding = asset.sliceBinding;
  fail(binding && binding.mediaType === 'image/png' && /^[a-f0-9]{64}$/.test(binding.digest), `assets.${key}.sliceBinding`, 'Resolve an exact native PNG slice binding.', 'ASSEMBLY_COMPONENT_UNSUPPORTED');
  fail(typeof projectId === 'string' && binding.projectId === projectId && (asset.projectId === undefined || asset.projectId === projectId), `assets.${key}.projectId`, 'Resolve the component from the same project.', 'ASSEMBLY_ASSET_PROJECT_MISMATCH');
  for (const dimension of ['width', 'height']) fail(Number.isSafeInteger(binding[dimension]) && binding[dimension] > 0 && binding[dimension] <= LIMIT && asset.metadata?.pixelSize?.[dimension] === binding[dimension], `assets.${key}.sliceBinding.${dimension}`, 'Use matching exact image dimensions.');
  const geometry = resolveAssetSpatialGeometry(asset);
  const leaf = { asset, geometry, artifact: { digest: binding.digest, mediaType: binding.mediaType, pixelSize: { width: binding.width, height: binding.height } } };
  cache.set(key, leaf); return leaf;
}
function finding(ruleId, path, explanation, remediation) { return { severity: 'ERROR', ruleId, path, explanation, remediation }; }
function sceneFor(assembly, selection, assets, projectId, cache) {
  const stateId = selection?.stateId ?? assembly.defaultStateId; const variantId = selection?.variantId ?? assembly.defaultVariantId;
  fail(assembly.states.some((s) => s.stateId === stateId), 'selection.stateId', 'Select a declared presentation state.');
  fail(assembly.variants.some((v) => v.variantId === variantId), 'selection.variantId', 'Select a declared variant.');
  const elements = []; const inherited = []; const findings = [];
  for (const component of assembly.components) {
    if (component.stateIds !== null && !component.stateIds.includes(stateId)) continue;
    const pin = component.variantOverrides.find((v) => v.variantId === variantId)?.asset ?? component.asset;
    const { geometry, artifact } = resolvedLeaf(pin, assets, projectId, cache);
    const matrix = assemblyComponentMatrix(component, geometry.anchor, assembly.unitsPerPixel);
    const imagePixelMatrix = [geometry.imageBounds.width / artifact.pixelSize.width, 0, 0, geometry.imageBounds.height / artifact.pixelSize.height, geometry.imageBounds.x, geometry.imageBounds.y];
    const imageMatrix = multiplyAssemblyMatrices(matrix, imagePixelMatrix);
    const imageBounds = boundedSceneRect(assemblyShapeBounds({ shape: { kind: 'rectangle', x: 0, y: 0, width: artifact.pixelSize.width, height: artifact.pixelSize.height }, transform: imageMatrix }), `components.${component.componentId}.imageBounds`);
    elements.push({ componentId: component.componentId, name: component.name, asset: { ...pin }, imageMatrix, imageBounds, anchor: { ...component.position }, artifact });
    for (const region of geometry.regions) inherited.push({ regionId: `${component.componentId.length}:${component.componentId}:${region.regionId}`, name: region.name, shape: structuredClone(region.shape), transform: [...matrix], componentId: component.componentId, asset: { ...pin }, sourceRegionId: region.regionId });
    for (const sourceFinding of geometry.findings) if (sourceFinding.severity === 'ERROR') findings.push(finding('studio.assembly.component.geometry_invalid', `/components/${component.componentId}/asset`, sourceFinding.explanation, `Correct the exact source Asset or explicitly choose a corrected version. ${sourceFinding.remediation}`));
  }
  const regions = assembly.blocking.mode === 'components' ? inherited : structuredClone(assembly.blocking.regions);
  for (const region of regions) {
    boundedSceneRect(assemblyShapeBounds(region), `regions.${region.regionId}`);
    if (!assemblyShapeContained(region, assembly.placementBounds)) findings.push(finding('studio.assembly.blocking_out_of_bounds', region.componentId ? `/components/${region.componentId}` : `/blocking/regions/${region.regionId}`, `Blocking region “${region.name}” exceeds the assembly placement bounds in ${variantId}/${stateId}.`, 'Enlarge the authored placement bounds or explicitly adjust the component/custom geometry; the shape is retained.'));
  }
  const visualBounds = unionBounds(elements.length ? elements.map((element) => element.imageBounds) : [assembly.placementBounds]);
  return { schemaVersion: 1, coordinateSpace: 'assembly-pixels', selection: { stateId, variantId }, placementBounds: { ...assembly.placementBounds }, anchor: { ...assembly.anchor }, visualBounds, elements, regions, findings };
}
export function resolveAssemblyScene({ assembly, assets, projectId, selection } = {}) {
  const normalized = normalizeAssemblyDeclaration(assembly);
  return sceneFor(normalized, selection, assetMap(assets), projectId, new Map());
}
export function validateAssemblyGeometry({ assembly, assets, projectId } = {}) {
  const normalized = normalizeAssemblyDeclaration(assembly); const map = assetMap(assets); const cache = new Map(); const pins = new Map();
  for (const component of normalized.components) for (const pin of [component.asset, ...component.variantOverrides.map((v) => v.asset)]) {
    pins.set(assemblyAssetKey(pin), { ...pin }); resolvedLeaf(pin, map, projectId, cache);
  }
  const findings = []; const frames = [normalized.placementBounds];
  // Resolve the bounded all-choice graph at validation time, never inside the
  // active-preview loop. Leaf geometry is cached per exact pin for this pass.
  for (const variant of normalized.variants) for (const state of normalized.states) {
    const scene = sceneFor(normalized, { variantId: variant.variantId, stateId: state.stateId }, map, projectId, cache);
    frames.push(scene.visualBounds); findings.push(...scene.findings);
  }
  // Even an unused component pin must refer to technically usable geometry.
  for (const [key, { geometry }] of cache) for (const source of geometry.findings) if (source.severity === 'ERROR') findings.push(finding('studio.assembly.component.geometry_invalid', `/assets/${key}`, source.explanation, source.remediation));
  return { findings, componentPins: [...pins.values()].sort((a, b) => assemblyAssetKey(a).localeCompare(assemblyAssetKey(b))), frameBounds: unionBounds(frames) };
}

export function snapshotAssemblyBlocking(regions) {
  list(regions, 'regions', ASSEMBLY_MAX_CUSTOM_REGIONS);
  const snapshot = regions.map((region, index) => {
    const shape = region.shape; const matrix = region.transform ?? ASSEMBLY_IDENTITY_MATRIX;
    const base = { regionId: `region.${index + 1}`, name: region.name };
    if (shape.kind === 'polygon') return { ...base, shape: { kind: 'polygon', points: shape.points.map((p) => transformAssemblyPoint(p, matrix)) }, transform: [...ASSEMBLY_IDENTITY_MATRIX] };
    const [a, b, c, d] = matrix; const scale = Math.hypot(a, b); const otherScale = Math.hypot(c, d);
    fail(scale > 0 && Math.abs(scale - otherScale) <= 32 * Number.EPSILON * Math.max(1, scale) && Math.abs(a * c + b * d) <= 32 * Number.EPSILON * Math.max(1, scale * scale) && a * d - b * c > 0, `regions[${index}].transform`, 'Snapshot requires positive uniform scale and rotation; unsupported geometry was retained.');
    const center = transformAssemblyPoint({ x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 }, matrix);
    const width = shape.width * scale; const height = shape.height * scale;
    return { ...base, shape: { kind: shape.kind, x: -width / 2, y: -height / 2, width, height }, transform: [a / scale, b / scale, c / scale, d / scale, center.x, center.y].map(clean) };
  });
  return normalizeAssemblyRegions(snapshot, 'snapshot.regions');
}
