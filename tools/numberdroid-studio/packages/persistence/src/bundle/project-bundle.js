import { createHash, randomUUID } from 'node:crypto';
import { constants, createReadStream } from 'node:fs';
import {
  copyFile,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, join, parse, relative, resolve, sep } from 'node:path';
import { StudioError, invariant } from '../../../domain/src/errors.js';
import { inspectImageHeader, verifyImageFile } from '../artifacts/image-metadata.js';

const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const BUNDLE_KIND = 'numberdroid-studio-project';
const MANIFEST_FILE = 'manifest.json';
const MANIFEST_DIGEST_FILE = 'manifest.sha256';
const PROJECT_FILE = 'project.json';
const ARTIFACT_PREFIX = join('artifacts', 'sha256');

export const PROJECT_BUNDLE_LIMITS = Object.freeze({
  maxProjectBytes: 16 * 1024 * 1024,
  maxManifestBytes: 4 * 1024 * 1024,
  maxArtifactCount: 4096,
  maxArtifactBytes: 128 * 1024 * 1024,
  maxTotalArtifactBytes: 512 * 1024 * 1024,
  maxImageWidth: 16384,
  maxImageHeight: 16384,
  maxJsonDepth: 14,
  maxJsonNodes: 250000,
  maxStringBytes: 1024 * 1024,
  maxSources: 1024,
  maxAtlases: 1024,
  maxLegacyAssets: 16384,
  maxSliceBindings: 16384,
  maxAssetVersions: 16384,
  maxAssetHeads: 4096,
  maxFindings: 16384,
  maxProposals: 4096,
  maxProposalItems: 64,
  maxAppliedJobs: 4096,
  maxRoomArchetypes: 128,
  maxRoomVariants: 512,
  maxRoomProposals: 4096,
  maxActivityEvents: 10000,
  maxFilesystemEntries: 20000,
});

const PROJECT_KEYS_V1 = Object.freeze([
  'schemaVersion',
  'bundleKind',
  'projectHead',
  'artifactDigests',
  'sources',
  'atlases',
  'legacyAssets',
  'assetLibrary',
  'proposals',
  'appliedJobHistory',
  'activity',
]);
const PROJECT_KEYS_V2 = Object.freeze([...PROJECT_KEYS_V1, 'roomLibrary']);
const PROJECT_HEAD_KEYS = Object.freeze([
  'projectId',
  'formatVersion',
  'revision',
  'revisionId',
  'name',
  'description',
  'ownerId',
  'status',
  'statusNote',
  'createdAt',
  'updatedAt',
]);
const ASSET_LIBRARY_KEYS = Object.freeze(['sliceBindings', 'versions', 'heads', 'findings']);
const MANIFEST_KEYS = Object.freeze([
  'schemaVersion',
  'bundleKind',
  'projectId',
  'revision',
  'project',
  'artifacts',
  'totals',
]);
const PROJECT_MANIFEST_KEYS = Object.freeze(['sha256', 'byteSize']);
const ARTIFACT_KEYS = Object.freeze(['digest', 'byteSize', 'mediaType', 'width', 'height']);
const TOTAL_KEYS = Object.freeze(['artifactCount', 'artifactBytes']);

const FORBIDDEN_EXACT_KEYS = new Set([
  'accessoperation',
  'accessoperations',
  'apikey',
  'attempt',
  'attemptid',
  'attempts',
  'authorization',
  'authorizationstatus',
  'branchid',
  'commandid',
  'correlationid',
  'credential',
  'credentials',
  'budget',
  'error',
  'errorcode',
  'failure',
  'grant',
  'grantid',
  'grants',
  'hostbinding',
  'hostbindingid',
  'hostbindings',
  'humanagentaccessoperations',
  'idempotencykey',
  'intakeid',
  'leaseexpiresat',
  'leaseowner',
  'operationidempotencykey',
  'objectscopes',
  'password',
  'rawerror',
  'rawfailure',
  'secret',
  'secrets',
  'scopes',
  'sourceintakeid',
  'sourceintakes',
  'stack',
  'stacktrace',
  'stagedintakes',
  'tokendigest',
  'token',
  'tokens',
  'usage',
]);

function normalizedKey(key) {
  return key.toLowerCase().replaceAll(/[^a-z0-9]/g, '');
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function exactKeys(value, expected, label) {
  invariant(isPlainObject(value), 'BUNDLE_SCHEMA_INVALID', `${label} must be an object.`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  invariant(
    actual.length === wanted.length && actual.every((key, index) => key === wanted[index]),
    'BUNDLE_SCHEMA_INVALID',
    `${label} contains missing or unknown fields.`,
    { label, expected: wanted, actual },
  );
}

function requireBoundedString(value, label, { min = 1, max = 2000, nullable = false } = {}) {
  if (nullable && value === null) return;
  invariant(typeof value === 'string' && value.length >= min && value.length <= max, 'BUNDLE_SCHEMA_INVALID', `${label} is invalid.`);
}

function requireInteger(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  invariant(Number.isSafeInteger(value) && value >= min && value <= max, 'BUNDLE_SCHEMA_INVALID', `${label} is invalid.`);
}

function requireCanonicalIso(value, label) {
  requireBoundedString(value, label, { max: 40 });
  const milliseconds = Date.parse(value);
  invariant(Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value, 'BUNDLE_SCHEMA_INVALID', `${label} must be a canonical ISO date-time.`);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function assertCanonicalValue(value, limits, state, path = '$', depth = 0) {
  invariant(depth <= limits.maxJsonDepth, 'BUNDLE_JSON_LIMIT', 'Bundle JSON nesting is too deep.', { path });
  state.nodes += 1;
  invariant(state.nodes <= limits.maxJsonNodes, 'BUNDLE_JSON_LIMIT', 'Bundle JSON contains too many values.');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    invariant(Number.isFinite(value), 'BUNDLE_SCHEMA_INVALID', 'Bundle JSON numbers must be finite.', { path });
    return;
  }
  if (typeof value === 'string') {
    invariant(Buffer.byteLength(value, 'utf8') <= limits.maxStringBytes, 'BUNDLE_JSON_LIMIT', 'Bundle JSON string is too large.', { path });
    return;
  }
  invariant(typeof value === 'object', 'BUNDLE_SCHEMA_INVALID', 'Bundle JSON contains an unsupported value.', { path });
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      assertCanonicalValue(value[index], limits, state, `${path}[${index}]`, depth + 1);
    }
    return;
  }
  invariant(isPlainObject(value), 'BUNDLE_SCHEMA_INVALID', 'Bundle JSON objects must use a plain prototype.', { path });
  for (const [key, child] of Object.entries(value)) {
    assertCanonicalValue(key, limits, state, `${path} key`, depth + 1);
    assertCanonicalValue(child, limits, state, `${path}.${key}`, depth + 1);
  }
}

function serializeCanonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((child) => serializeCanonicalJson(child)).join(',')}]`;
  const entries = Object.entries(value).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${serializeCanonicalJson(child)}`).join(',')}}`;
}

export function canonicalBundleJson(value, limits = PROJECT_BUNDLE_LIMITS) {
  assertCanonicalValue(value, limits, { nodes: 0 });
  return serializeCanonicalJson(value);
}

function artifactRelativePath(digest) {
  invariant(DIGEST_PATTERN.test(digest), 'BUNDLE_ARTIFACT_INVALID', 'Artifact digest must be lowercase SHA-256 hex.', { digest });
  return join(ARTIFACT_PREFIX, digest.slice(0, 2), digest.slice(2, 4), digest);
}

function assertNoAuthorityOrMachineState(value, artifactDigests, path = '$', parentKey = '') {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return;
  if (typeof value === 'string') {
    const normalizedParent = normalizedKey(parentKey);
    const semanticFindingPath = normalizedParent === 'path';
    const traversal = /(^|[\\/])\.\.([\\/]|$)/.test(value);
    const machineAbsolute = /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('\\\\')
      || (!semanticFindingPath && value.startsWith('/'));
    const scheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value) || value.startsWith('file:');
    const knownMachineFindingPath = semanticFindingPath
      && /^\/(?:tmp|home|users|var|workspace|root|etc|mnt|volumes)(?:\/|$)/i.test(value);
    invariant(!traversal && !machineAbsolute && !scheme && !knownMachineFindingPath, 'BUNDLE_MACHINE_LOCATION_FORBIDDEN', 'Bundle semantic data contains a path, traversal, or URI.', { path });
    if (normalizedParent.endsWith('digest') || normalizedParent.endsWith('digests')) {
      invariant(DIGEST_PATTERN.test(value), 'BUNDLE_ARTIFACT_INVALID', 'Semantic artifact digest is invalid.', { path });
      invariant(artifactDigests.has(value), 'BUNDLE_CAS_CLOSURE_MISMATCH', 'Semantic data names an artifact outside the manifest closure.', { path, digest: value });
    }
    return;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      assertNoAuthorityOrMachineState(value[index], artifactDigests, `${path}[${index}]`, parentKey);
    }
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizedKey(key);
    const locationKey = normalized !== 'path' && (
      normalized.endsWith('path') || normalized.endsWith('directory') || normalized.endsWith('location')
      || normalized.endsWith('filename') || normalized.endsWith('uri') || normalized.endsWith('url')
    );
    const secretKey = normalized.includes('secret') || normalized.includes('password')
      || normalized.includes('credential') || normalized.includes('apikey') || normalized.includes('tokendigest');
    const authorityKey = normalized.includes('idempotency') || normalized.startsWith('hostbinding')
      || normalized.startsWith('lease') || normalized.endsWith('grantid')
      || normalized.endsWith('branchid') || FORBIDDEN_EXACT_KEYS.has(normalized);
    invariant(!locationKey, 'BUNDLE_MACHINE_LOCATION_FORBIDDEN', 'Bundle semantic data contains a machine-location field.', { path: `${path}.${key}`, key });
    invariant(!secretKey && !authorityKey, 'BUNDLE_AUTHORITY_FORBIDDEN', 'Bundle semantic data contains authority, secret, or operational state.', { path: `${path}.${key}`, key });
    assertNoAuthorityOrMachineState(child, artifactDigests, `${path}.${key}`, key);
  }
}

function assertObjectArray(value, label, limit) {
  invariant(Array.isArray(value) && value.length <= limit, 'BUNDLE_COUNT_LIMIT', `${label} exceeds its bundle count limit.`, { label, limit });
  for (const [index, entry] of value.entries()) {
    invariant(isPlainObject(entry), 'BUNDLE_SCHEMA_INVALID', `${label}[${index}] must be an object.`);
  }
}

function validateProposalQuiescence(proposals, limits) {
  for (const [index, proposal] of proposals.entries()) {
    invariant(
      proposal.status === 'APPLIED',
      'BUNDLE_NOT_QUIESCENT',
      'Only fully decided and applied asset proposals may enter a portable bundle.',
      { index, status: proposal.status ?? null },
    );
    if (proposal.items !== undefined) {
      invariant(Array.isArray(proposal.items) && proposal.items.length >= 1 && proposal.items.length <= limits.maxProposalItems, 'BUNDLE_COUNT_LIMIT', 'Proposal item count is outside the bundle limit.', { index });
    }
  }
}

function validateAppliedJobHistory(jobs) {
  for (const [index, job] of jobs.entries()) {
    invariant(job.state === 'APPLIED', 'BUNDLE_NOT_QUIESCENT', 'Portable job history may contain only APPLIED jobs.', { index, state: job.state ?? null });
  }
}

export function validatePortableProjectDocument(project, { limits = PROJECT_BUNDLE_LIMITS, semanticValidator = null } = {}) {
  invariant([1, 2, 3].includes(project?.schemaVersion) && project.bundleKind === BUNDLE_KIND, 'BUNDLE_SCHEMA_UNSUPPORTED', 'Unsupported portable project schema.');
  exactKeys(project, project.schemaVersion >= 2 ? PROJECT_KEYS_V2 : PROJECT_KEYS_V1, 'project.json');
  exactKeys(project.projectHead, PROJECT_HEAD_KEYS, 'projectHead');
  exactKeys(project.assetLibrary, ASSET_LIBRARY_KEYS, 'assetLibrary');
  const head = project.projectHead;
  requireBoundedString(head.projectId, 'projectHead.projectId', { max: 160 });
  requireInteger(head.formatVersion, 'projectHead.formatVersion', { min: 1 });
  requireInteger(head.revision, 'projectHead.revision', { min: 1 });
  requireBoundedString(head.revisionId, 'projectHead.revisionId', { max: 200 });
  requireBoundedString(head.name, 'projectHead.name', { max: 160 });
  requireBoundedString(head.description, 'projectHead.description', { min: 0, max: 2000, nullable: true });
  requireBoundedString(head.ownerId, 'projectHead.ownerId', { max: 160 });
  requireBoundedString(head.status, 'projectHead.status', { max: 64 });
  requireBoundedString(head.statusNote, 'projectHead.statusNote', { min: 0, max: 1000, nullable: true });
  requireCanonicalIso(head.createdAt, 'projectHead.createdAt');
  requireCanonicalIso(head.updatedAt, 'projectHead.updatedAt');

  invariant(Array.isArray(project.artifactDigests) && project.artifactDigests.length <= limits.maxArtifactCount, 'BUNDLE_COUNT_LIMIT', 'artifactDigests exceeds its bundle count limit.');
  const sortedDigests = [...project.artifactDigests].sort();
  invariant(sortedDigests.every((digest) => DIGEST_PATTERN.test(digest)), 'BUNDLE_ARTIFACT_INVALID', 'artifactDigests contains an invalid digest.');
  invariant(new Set(sortedDigests).size === sortedDigests.length, 'BUNDLE_CAS_CLOSURE_MISMATCH', 'artifactDigests contains a duplicate digest.');
  invariant(project.artifactDigests.every((digest, index) => digest === sortedDigests[index]), 'BUNDLE_NONCANONICAL', 'artifactDigests must be sorted.');

  assertObjectArray(project.sources, 'sources', limits.maxSources);
  assertObjectArray(project.atlases, 'atlases', limits.maxAtlases);
  assertObjectArray(project.legacyAssets, 'legacyAssets', limits.maxLegacyAssets);
  assertObjectArray(project.assetLibrary.sliceBindings, 'assetLibrary.sliceBindings', limits.maxSliceBindings);
  assertObjectArray(project.assetLibrary.versions, 'assetLibrary.versions', limits.maxAssetVersions);
  assertObjectArray(project.assetLibrary.heads, 'assetLibrary.heads', limits.maxAssetHeads);
  assertObjectArray(project.assetLibrary.findings, 'assetLibrary.findings', limits.maxFindings);
  assertObjectArray(project.proposals, 'proposals', limits.maxProposals);
  assertObjectArray(project.appliedJobHistory, 'appliedJobHistory', limits.maxAppliedJobs);
  assertObjectArray(project.activity, 'activity', limits.maxActivityEvents);
  if (project.schemaVersion >= 2) {
    exactKeys(project.roomLibrary, ['archetypes', 'variants', 'proposals'], 'roomLibrary');
    assertObjectArray(project.roomLibrary.archetypes, 'roomLibrary.archetypes', limits.maxRoomArchetypes);
    assertObjectArray(project.roomLibrary.variants, 'roomLibrary.variants', limits.maxRoomVariants);
    assertObjectArray(project.roomLibrary.proposals, 'roomLibrary.proposals', limits.maxRoomProposals);
  }
  validateProposalQuiescence(project.proposals, limits);
  validateAppliedJobHistory(project.appliedJobHistory);
  canonicalBundleJson(project, limits);
  const digestSet = new Set(sortedDigests);
  assertNoAuthorityOrMachineState(project, digestSet);
  semanticValidator?.(structuredClone(project));
  return structuredClone(project);
}

function validateArtifactEntry(entry, limits, index) {
  exactKeys(entry, ARTIFACT_KEYS, `artifacts[${index}]`);
  invariant(DIGEST_PATTERN.test(entry.digest), 'BUNDLE_ARTIFACT_INVALID', 'Artifact digest must be lowercase SHA-256 hex.', { index });
  requireInteger(entry.byteSize, `artifacts[${index}].byteSize`, { min: 1, max: limits.maxArtifactBytes });
  invariant(entry.mediaType === 'image/png' || entry.mediaType === 'image/webp', 'BUNDLE_ARTIFACT_INVALID', 'Artifact media type is unsupported.', { index, mediaType: entry.mediaType });
  requireInteger(entry.width, `artifacts[${index}].width`, { min: 1, max: limits.maxImageWidth });
  requireInteger(entry.height, `artifacts[${index}].height`, { min: 1, max: limits.maxImageHeight });
}

function normalizeArtifactEntries(artifacts, limits) {
  invariant(Array.isArray(artifacts) && artifacts.length <= limits.maxArtifactCount, 'BUNDLE_COUNT_LIMIT', 'Artifact count exceeds the bundle limit.');
  const result = artifacts.map((entry) => structuredClone(entry)).sort((left, right) => left.digest.localeCompare(right.digest));
  result.forEach((entry, index) => validateArtifactEntry(entry, limits, index));
  invariant(new Set(result.map((entry) => entry.digest)).size === result.length, 'BUNDLE_CAS_CLOSURE_MISMATCH', 'Artifact manifest contains a duplicate digest.');
  const total = result.reduce((sum, entry) => sum + entry.byteSize, 0);
  invariant(Number.isSafeInteger(total) && total <= limits.maxTotalArtifactBytes, 'BUNDLE_ARTIFACT_BYTES_LIMIT', 'Artifact closure exceeds the bundle byte limit.', { total, limit: limits.maxTotalArtifactBytes });
  return result;
}

function validateManifest(manifest, limits) {
  exactKeys(manifest, MANIFEST_KEYS, 'manifest.json');
  invariant(manifest.schemaVersion === 1 && manifest.bundleKind === BUNDLE_KIND, 'BUNDLE_SCHEMA_UNSUPPORTED', 'Unsupported bundle manifest schema.');
  requireBoundedString(manifest.projectId, 'manifest.projectId', { max: 160 });
  requireInteger(manifest.revision, 'manifest.revision', { min: 1 });
  exactKeys(manifest.project, PROJECT_MANIFEST_KEYS, 'manifest.project');
  invariant(DIGEST_PATTERN.test(manifest.project.sha256), 'BUNDLE_SCHEMA_INVALID', 'manifest.project.sha256 is invalid.');
  requireInteger(manifest.project.byteSize, 'manifest.project.byteSize', { min: 1, max: limits.maxProjectBytes });
  const artifacts = normalizeArtifactEntries(manifest.artifacts, limits);
  invariant(manifest.artifacts.every((entry, index) => entry.digest === artifacts[index].digest), 'BUNDLE_NONCANONICAL', 'Manifest artifacts must be sorted by digest.');
  exactKeys(manifest.totals, TOTAL_KEYS, 'manifest.totals');
  const artifactBytes = artifacts.reduce((sum, entry) => sum + entry.byteSize, 0);
  invariant(manifest.totals.artifactCount === artifacts.length && manifest.totals.artifactBytes === artifactBytes, 'BUNDLE_SCHEMA_INVALID', 'Manifest totals do not match its artifact entries.');
  canonicalBundleJson(manifest, limits);
  return artifacts;
}

async function readCanonicalJsonFile(path, { maxBytes, label, limits }) {
  const info = await lstat(path).catch((error) => {
    if (error.code === 'ENOENT') throw new StudioError('BUNDLE_FILE_MISSING', `Bundle is missing ${label}.`);
    throw error;
  });
  invariant(info.isFile() && !info.isSymbolicLink(), 'BUNDLE_TREE_INVALID', `${label} must be a regular file.`);
  invariant(info.size > 0 && info.size <= maxBytes, 'BUNDLE_JSON_LIMIT', `${label} exceeds its byte limit.`, { byteSize: info.size, maxBytes });
  const bytes = await readFile(path);
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new StudioError('BUNDLE_JSON_INVALID', `${label} is not valid JSON.`, { cause: error.message });
  }
  const canonical = Buffer.from(canonicalBundleJson(value, limits), 'utf8');
  invariant(bytes.equals(canonical), 'BUNDLE_NONCANONICAL', `${label} is not exact canonical JSON.`);
  return { value, bytes };
}

async function walkTree(root, limits) {
  const rootInfo = await lstat(root).catch((error) => {
    if (error.code === 'ENOENT') throw new StudioError('BUNDLE_NOT_FOUND', 'Portable bundle directory does not exist.');
    throw error;
  });
  invariant(rootInfo.isDirectory() && !rootInfo.isSymbolicLink(), 'BUNDLE_TREE_INVALID', 'Portable bundle root must be a real directory.');
  const paths = new Map();
  const pending = [''];
  let count = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    const entries = await readdir(join(root, current), { withFileTypes: true });
    for (const entry of entries) {
      count += 1;
      invariant(count <= limits.maxFilesystemEntries, 'BUNDLE_COUNT_LIMIT', 'Bundle tree contains too many entries.');
      const child = current ? join(current, entry.name) : entry.name;
      const childPath = join(root, child);
      const info = await lstat(childPath);
      invariant(!info.isSymbolicLink(), 'BUNDLE_SYMLINK_FORBIDDEN', 'Bundle tree must not contain symbolic links.', { path: child });
      invariant(info.isDirectory() || info.isFile(), 'BUNDLE_TREE_INVALID', 'Bundle tree contains a non-regular entry.', { path: child });
      paths.set(child, info.isDirectory() ? 'directory' : 'file');
      if (info.isDirectory()) pending.push(child);
    }
  }
  return paths;
}

function expectedTree(artifacts) {
  const expected = new Map([
    [MANIFEST_FILE, 'file'],
    [MANIFEST_DIGEST_FILE, 'file'],
    [PROJECT_FILE, 'file'],
    ['artifacts', 'directory'],
    [ARTIFACT_PREFIX, 'directory'],
  ]);
  for (const artifact of artifacts) {
    const first = join(ARTIFACT_PREFIX, artifact.digest.slice(0, 2));
    const second = join(first, artifact.digest.slice(2, 4));
    expected.set(first, 'directory');
    expected.set(second, 'directory');
    expected.set(artifactRelativePath(artifact.digest), 'file');
  }
  return expected;
}

function compareTrees(actual, expected) {
  const actualEntries = [...actual.entries()].sort(([left], [right]) => left.localeCompare(right));
  const expectedEntries = [...expected.entries()].sort(([left], [right]) => left.localeCompare(right));
  invariant(
    actualEntries.length === expectedEntries.length
      && actualEntries.every(([path, kind], index) => path === expectedEntries[index][0] && kind === expectedEntries[index][1]),
    'BUNDLE_TREE_INVALID',
    'Bundle contains extra, missing, or misplaced files.',
    {
      actual: actualEntries.map(([path, kind]) => `${kind}:${path}`),
      expected: expectedEntries.map(([path, kind]) => `${kind}:${path}`),
    },
  );
}

async function verifyArtifactFile(path, expected) {
  const info = await lstat(path).catch((error) => {
    if (error.code === 'ENOENT') throw new StudioError('BUNDLE_ARTIFACT_MISSING', 'Bundle artifact is missing.', { digest: expected.digest });
    throw error;
  });
  invariant(info.isFile() && !info.isSymbolicLink(), 'BUNDLE_TREE_INVALID', 'Bundle artifact must be a regular file.', { digest: expected.digest });
  invariant(info.size === expected.byteSize, 'BUNDLE_ARTIFACT_SIZE_MISMATCH', 'Bundle artifact byte length differs from the manifest.', { digest: expected.digest, expected: expected.byteSize, actual: info.size });
  const hash = createHash('sha256');
  const headerParts = [];
  let headerBytes = 0;
  let byteSize = 0;
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
    byteSize += chunk.length;
    if (headerBytes < 64) {
      const part = chunk.subarray(0, Math.min(chunk.length, 64 - headerBytes));
      headerParts.push(part);
      headerBytes += part.length;
    }
  }
  invariant(byteSize === expected.byteSize && hash.digest('hex') === expected.digest, 'BUNDLE_ARTIFACT_DIGEST_MISMATCH', 'Bundle artifact differs from its manifest digest.', { digest: expected.digest });
  const dimensions = inspectImageHeader(Buffer.concat(headerParts), expected.mediaType);
  invariant(dimensions.width === expected.width && dimensions.height === expected.height, 'BUNDLE_ARTIFACT_METADATA_MISMATCH', 'Bundle artifact dimensions differ from the manifest.', { digest: expected.digest, expected: { width: expected.width, height: expected.height }, actual: dimensions });
  await verifyImageFile(path, expected.mediaType);
  return { ...expected, path };
}

async function syncPath(path) {
  let handle;
  try {
    handle = await open(path, 'r');
    await handle.sync();
  } catch (error) {
    if (!['EINVAL', 'ENOTSUP', 'EISDIR', 'EPERM'].includes(error.code)) throw error;
  } finally {
    await handle?.close();
  }
}

async function syncTree(root) {
  const tree = await walkTree(root, { ...PROJECT_BUNDLE_LIMITS, maxFilesystemEntries: Number.MAX_SAFE_INTEGER });
  const files = [...tree.entries()].filter(([, kind]) => kind === 'file').map(([path]) => path);
  const directories = [...tree.entries()].filter(([, kind]) => kind === 'directory').map(([path]) => path)
    .sort((left, right) => right.split(sep).length - left.split(sep).length);
  for (const file of files) await syncPath(join(root, file));
  for (const directory of directories) await syncPath(join(root, directory));
  await syncPath(root);
}

async function assertDestinationAbsent(destination) {
  await lstat(destination).then(
    () => { throw new StudioError('BUNDLE_DESTINATION_EXISTS', 'Portable bundle operations never overwrite a destination.', { destination }); },
    (error) => { if (error.code !== 'ENOENT') throw error; },
  );
}

function resolveDestination(destinationDirectory) {
  invariant(typeof destinationDirectory === 'string' && destinationDirectory.length > 0, 'VALIDATION_ERROR', 'destinationDirectory is required.');
  const destination = resolve(destinationDirectory);
  invariant(destination !== parse(destination).root, 'VALIDATION_ERROR', 'Filesystem roots cannot be portable bundle destinations.');
  return destination;
}

async function createSiblingStage(destination, purpose) {
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  await assertDestinationAbsent(destination);
  const stage = join(dirname(destination), `.${basename(destination)}.${purpose}-${randomUUID()}`);
  await mkdir(stage, { recursive: false, mode: 0o700 });
  return stage;
}

export async function verifyPortableProjectBundle(bundleDirectory, {
  limits = PROJECT_BUNDLE_LIMITS,
  semanticValidator = null,
} = {}) {
  invariant(typeof bundleDirectory === 'string' && bundleDirectory.length > 0, 'VALIDATION_ERROR', 'bundleDirectory is required.');
  const root = resolve(bundleDirectory);
  const actualTree = await walkTree(root, limits);
  const manifestRecord = await readCanonicalJsonFile(join(root, MANIFEST_FILE), {
    maxBytes: limits.maxManifestBytes,
    label: MANIFEST_FILE,
    limits,
  });
  const artifacts = validateManifest(manifestRecord.value, limits);
  compareTrees(actualTree, expectedTree(artifacts));
  const manifestDigestBytes = await readFile(join(root, MANIFEST_DIGEST_FILE));
  invariant(manifestDigestBytes.length === 64 && DIGEST_PATTERN.test(manifestDigestBytes.toString('ascii')), 'BUNDLE_MANIFEST_DIGEST_INVALID', 'manifest.sha256 must contain exactly one lowercase SHA-256 digest.');
  const manifestDigest = sha256(manifestRecord.bytes);
  invariant(manifestDigestBytes.toString('ascii') === manifestDigest, 'BUNDLE_MANIFEST_DIGEST_MISMATCH', 'manifest.json differs from manifest.sha256.');

  const projectRecord = await readCanonicalJsonFile(join(root, PROJECT_FILE), {
    maxBytes: limits.maxProjectBytes,
    label: PROJECT_FILE,
    limits,
  });
  const project = validatePortableProjectDocument(projectRecord.value, { limits, semanticValidator });
  const manifest = manifestRecord.value;
  invariant(project.projectHead.projectId === manifest.projectId && project.projectHead.revision === manifest.revision, 'BUNDLE_PROJECT_MISMATCH', 'Project head differs from the bundle manifest.');
  invariant(projectRecord.bytes.length === manifest.project.byteSize && sha256(projectRecord.bytes) === manifest.project.sha256, 'BUNDLE_PROJECT_DIGEST_MISMATCH', 'project.json differs from the bundle manifest.');
  invariant(
    project.artifactDigests.length === artifacts.length
      && project.artifactDigests.every((digest, index) => digest === artifacts[index].digest),
    'BUNDLE_CAS_CLOSURE_MISMATCH',
    'project.json and manifest.json name different CAS closures.',
  );
  const verifiedArtifacts = [];
  for (const artifact of artifacts) {
    verifiedArtifacts.push(await verifyArtifactFile(join(root, artifactRelativePath(artifact.digest)), artifact));
  }
  return {
    ok: true,
    root,
    manifest: structuredClone(manifest),
    manifestDigest,
    project,
    projectDigest: manifest.project.sha256,
    artifacts: verifiedArtifacts,
  };
}

export async function createPortableProjectBundle({
  destinationDirectory,
  project,
  artifacts,
  artifactStore,
  limits = PROJECT_BUNDLE_LIMITS,
  semanticValidator = null,
}) {
  invariant(artifactStore && typeof artifactStore.verify === 'function', 'VALIDATION_ERROR', 'A verified content-addressed artifactStore is required.');
  const destination = resolveDestination(destinationDirectory);
  const normalizedProject = validatePortableProjectDocument(project, { limits, semanticValidator });
  const normalizedArtifacts = normalizeArtifactEntries(artifacts, limits);
  invariant(
    normalizedProject.artifactDigests.length === normalizedArtifacts.length
      && normalizedProject.artifactDigests.every((digest, index) => digest === normalizedArtifacts[index].digest),
    'BUNDLE_CAS_CLOSURE_MISMATCH',
    'The sanitized project and artifact metadata name different CAS closures.',
  );
  const projectBytes = Buffer.from(canonicalBundleJson(normalizedProject, limits), 'utf8');
  invariant(projectBytes.length <= limits.maxProjectBytes, 'BUNDLE_JSON_LIMIT', 'project.json exceeds its byte limit.');
  const artifactBytes = normalizedArtifacts.reduce((sum, artifact) => sum + artifact.byteSize, 0);
  const manifest = {
    schemaVersion: 1,
    bundleKind: BUNDLE_KIND,
    projectId: normalizedProject.projectHead.projectId,
    revision: normalizedProject.projectHead.revision,
    project: { sha256: sha256(projectBytes), byteSize: projectBytes.length },
    artifacts: normalizedArtifacts,
    totals: { artifactCount: normalizedArtifacts.length, artifactBytes },
  };
  const manifestBytes = Buffer.from(canonicalBundleJson(manifest, limits), 'utf8');
  invariant(manifestBytes.length <= limits.maxManifestBytes, 'BUNDLE_JSON_LIMIT', 'manifest.json exceeds its byte limit.');
  const stage = await createSiblingStage(destination, 'bundle-stage');
  try {
    await mkdir(join(stage, ARTIFACT_PREFIX), { recursive: true, mode: 0o700 });
    await writeFile(join(stage, PROJECT_FILE), projectBytes, { flag: 'wx', mode: 0o600 });
    for (const artifact of normalizedArtifacts) {
      const verified = await artifactStore.verify(artifact.digest);
      invariant(verified.byteSize === artifact.byteSize, 'BUNDLE_ARTIFACT_METADATA_MISMATCH', 'Live CAS byte length differs from export metadata.', { digest: artifact.digest });
      const sourceInfo = await lstat(verified.path);
      invariant(sourceInfo.isFile() && !sourceInfo.isSymbolicLink(), 'BUNDLE_TREE_INVALID', 'Live CAS object must be a regular file.', { digest: artifact.digest });
      const target = join(stage, artifactRelativePath(artifact.digest));
      await mkdir(dirname(target), { recursive: true, mode: 0o700 });
      await copyFile(verified.path, target, constants.COPYFILE_EXCL);
      await verifyArtifactFile(target, artifact);
    }
    await writeFile(join(stage, MANIFEST_FILE), manifestBytes, { flag: 'wx', mode: 0o600 });
    await writeFile(join(stage, MANIFEST_DIGEST_FILE), sha256(manifestBytes), { flag: 'wx', mode: 0o600 });
    const verifiedStage = await verifyPortableProjectBundle(stage, { limits, semanticValidator });
    await syncTree(stage);
    await assertDestinationAbsent(destination);
    await rename(stage, destination);
    await syncPath(dirname(destination));
    return {
      ...verifiedStage,
      root: destination,
      artifacts: verifiedStage.artifacts.map((artifact) => ({
        ...artifact,
        path: join(destination, artifactRelativePath(artifact.digest)),
      })),
    };
  } catch (error) {
    await rm(stage, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function copyVerifiedArtifacts(verification, artifactDirectory) {
  await mkdir(join(artifactDirectory, 'sha256'), { recursive: true, mode: 0o700 });
  for (const artifact of verification.artifacts) {
    const relativeArtifact = join('sha256', artifact.digest.slice(0, 2), artifact.digest.slice(2, 4), artifact.digest);
    const target = join(artifactDirectory, relativeArtifact);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await copyFile(artifact.path, target, constants.COPYFILE_EXCL);
    await verifyArtifactFile(target, artifact);
  }
}

function assertInside(root, candidate, label) {
  const rel = relative(root, resolve(candidate));
  invariant(rel === '' || (!rel.startsWith('..') && !rel.startsWith(sep)), 'BUNDLE_IMPORT_INVALID', `${label} must stay inside the staged destination.`);
}

/**
 * Publishes a verified bundle into a new workspace directory. The materialize
 * callback is the deliberate schema-v9 integration seam: it receives already
 * verified, sanitized semantic data and copied CAS objects, must create the
 * semantic database inside staging, run its database/asset integrity checks,
 * close and checkpoint all handles, and return `{ integrity: { ok: true } }`.
 * This transport layer never copies or scrubs an authoritative SQLite file.
 */
export async function importPortableProjectBundle({
  bundleDirectory,
  destinationDirectory,
  materialize,
  limits = PROJECT_BUNDLE_LIMITS,
  semanticValidator = null,
}) {
  invariant(typeof materialize === 'function', 'VALIDATION_ERROR', 'A schema-v9 bundle materializer is required.');
  const destination = resolveDestination(destinationDirectory);
  await assertDestinationAbsent(destination);
  const verification = await verifyPortableProjectBundle(bundleDirectory, { limits, semanticValidator });
  const stage = await createSiblingStage(destination, 'import-stage');
  try {
    const artifactDirectory = join(stage, 'artifacts');
    await copyVerifiedArtifacts(verification, artifactDirectory);
    const materialized = await materialize({
      stagingDirectory: stage,
      artifactDirectory,
      project: structuredClone(verification.project),
      manifest: structuredClone(verification.manifest),
      manifestDigest: verification.manifestDigest,
      projectDigest: verification.projectDigest,
      artifacts: verification.artifacts.map(({ path: _path, ...artifact }) => structuredClone(artifact)),
    });
    invariant(materialized?.integrity?.ok === true, 'BUNDLE_IMPORT_INTEGRITY_FAILED', 'Imported semantic workspace did not pass full integrity verification.');
    if (materialized.databasePath !== undefined) assertInside(stage, materialized.databasePath, 'databasePath');
    const importedTree = await walkTree(stage, limits);
    for (const [path, kind] of importedTree) {
      invariant(kind === 'file' || kind === 'directory', 'BUNDLE_TREE_INVALID', 'Staged import contains an unsupported entry.', { path });
    }
    await syncTree(stage);
    await assertDestinationAbsent(destination);
    await rename(stage, destination);
    await syncPath(dirname(destination));
    return {
      ok: true,
      destination,
      projectId: verification.manifest.projectId,
      revision: verification.manifest.revision,
      manifestDigest: verification.manifestDigest,
      projectDigest: verification.projectDigest,
      artifactCount: verification.artifacts.length,
      integrity: structuredClone(materialized.integrity),
    };
  } catch (error) {
    await rm(stage, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}
