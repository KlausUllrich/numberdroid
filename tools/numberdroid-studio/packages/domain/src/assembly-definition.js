import { createHash } from 'node:crypto';
import { invariant } from './errors.js';
import { requireEnum, requireId, requireString } from './validation.js';
import { ASSET_KINDS, validateExactSliceBinding } from './asset-definition.js';
import { ASSEMBLY_MAX_BYTES, normalizeAssemblyDeclaration, validateAssemblyGeometry } from './assembly-geometry.js';

export { ASSEMBLY_DECLARATION_SCHEMA, ASSEMBLY_DECLARATION_V2_SCHEMA, ASSEMBLY_ANY_DECLARATION_SCHEMA, ASSEMBLY_PIN_SCHEMA, ASSEMBLY_REGION_SCHEMA, normalizeAssemblyDeclaration, normalizeAssemblyPin } from './assembly-geometry.js';
export const ASSEMBLY_VALIDATOR_VERSION = 'numberdroid-studio.assembly-validator.v1';
function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
export const ASSEMBLY_METADATA_SCHEMA = freeze({ type: 'object', additionalProperties: false, required: ['role', 'tags'], properties: {
  role: { oneOf: [{ type: 'null' }, { type: 'string', minLength: 1, maxLength: 64 }] },
  tags: { type: 'array', maxItems: 32, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 64 } },
} });
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  return value;
}
export function assemblyFingerprint(value) { return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex'); }
export function normalizeAssemblyMetadata(value) {
  invariant(value && typeof value === 'object' && !Array.isArray(value), 'ASSEMBLY_METADATA_INVALID', 'metadata: Provide role and tags.', { field: 'metadata' });
  for (const key of Reflect.ownKeys(value)) invariant(typeof key === 'string' && ['role', 'tags'].includes(key), 'ASSEMBLY_METADATA_INVALID', `metadata.${String(key)}: Remove this unsupported field.`, { field: `metadata.${String(key)}` });
  for (const key of ['role', 'tags']) invariant(Object.hasOwn(value, key), 'ASSEMBLY_METADATA_INVALID', `metadata.${key}: Provide this required field.`, { field: `metadata.${key}` });
  const role = value.role === null ? null : requireString(value.role, 'metadata.role', { max: 64 });
  invariant(Array.isArray(value.tags) && value.tags.length <= 32, 'ASSEMBLY_METADATA_INVALID', 'metadata.tags: Use at most 32 distinct tags.', { field: 'metadata.tags' });
  const tags = Array.from(value.tags, (tag, index) => requireString(tag, `metadata.tags[${index}]`, { max: 64 }));
  invariant(new Set(tags).size === tags.length, 'ASSEMBLY_METADATA_INVALID', 'metadata.tags: Remove duplicate tags.', { field: 'metadata.tags' });
  return { role, tags };
}

export function validateAssemblyDefinition({ assetId, name, kind, metadata, assembly, assets, projectId }) {
  const normalizedAssetId = requireId(assetId, 'assetId'); const normalizedName = requireString(name, 'name', { max: 160 });
  const normalizedKind = requireEnum(kind, 'kind', ASSET_KINDS); const normalizedMetadata = normalizeAssemblyMetadata(metadata); const declaration = normalizeAssemblyDeclaration(assembly);
  const content = { assetId: normalizedAssetId, name: normalizedName, kind: normalizedKind, metadata: normalizedMetadata, assembly: declaration };
  invariant(Buffer.byteLength(JSON.stringify(content), 'utf8') <= ASSEMBLY_MAX_BYTES, 'ASSEMBLY_INVALID', 'assembly: Reduce the complete declaration and metadata to at most 256 KiB.', { field: 'assembly' });
  const resolved = validateAssemblyGeometry({ assembly: declaration, assets, projectId });
  const records = assets instanceof Map ? [...assets.values()] : assets;
  // Geometry is portable; the command validator also checks the complete native
  // binding format. The store additionally proves historical/CAS provenance.
  for (const pin of resolved.componentPins) {
    const leaf = records.find((asset) => asset.assetId === pin.assetId && asset.assetVersion === pin.assetVersion && asset.metadataVersion === pin.metadataVersion);
    if (leaf.contentKind === 'animation') for (const frame of leaf.frameBindings) validateExactSliceBinding(frame.sliceBinding);
    else validateExactSliceBinding(leaf.sliceBinding);
  }
  const rawFindings = [...resolved.findings];
  if (normalizedMetadata.role === null) rawFindings.push({ severity: 'WARNING', ruleId: 'studio.assembly.role_missing', path: '/metadata/role', explanation: 'The assembly has no descriptive role yet.', remediation: 'Add an optional role when useful; this does not prevent saving DRAFT work.' });
  const findings = [...new Map(rawFindings.map((entry) => {
    const findingId = `${entry.ruleId}:${assemblyFingerprint({ assetId: normalizedAssetId, ...entry }).slice(0, 24)}`;
    return [findingId, { findingId, ...entry, targetKind: 'assembly', targetId: normalizedAssetId, validatorVersion: ASSEMBLY_VALIDATOR_VERSION }];
  })).values()];
  return { ...content, metadataFingerprint: assemblyFingerprint({ kind: normalizedKind, metadata: normalizedMetadata, assembly: declaration }), contentFingerprint: assemblyFingerprint(content), findings, componentPins: resolved.componentPins, frameBounds: resolved.frameBounds };
}
