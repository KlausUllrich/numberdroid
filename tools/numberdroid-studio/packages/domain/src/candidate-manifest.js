import { createHash } from 'node:crypto';
import { invariant } from './errors.js';

export const CANDIDATE_MANIFEST_SCHEMA_VERSION = 1;
export const CANDIDATE_MANIFEST_KIND = 'studio.candidate-manifest';
export const CANDIDATE_STATUSES = Object.freeze(['BLOCKED', 'VERIFIED']);
export const CANDIDATE_COMPILER_STATUSES = Object.freeze([
  'SUCCEEDED',
  'FAILED',
  'NOT_RUN',
  'SKIPPED',
]);

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const TOKEN_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const NAMESPACED_ID_PATTERN = /^[a-z][a-z0-9_-]*(?:\.[a-z0-9][a-z0-9_-]*)+$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const STABLE_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,255}$/;
const LOGICAL_PATH_SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;
const MEDIA_TYPE_PATTERN = /^[a-z][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;
const CAS_URI_PATTERN = /^studio:\/\/artifacts\/sha256\/([a-f0-9]{64})$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const MACHINE_PATH_PATTERN = /(?:[A-Za-z]:[\\/]|\\\\|(?:^|\s)\/(?:home|users|root|tmp|var|etc|opt|workspace|mnt|srv)(?:[\/\s]|$))/i;
const SEVERITY_ORDER = Object.freeze({ ERROR: 0, WARNING: 1, INFO: 2 });

function exactFields(value, allowed, label) {
  invariant(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'CANDIDATE_MANIFEST_INVALID',
    `${label} must be an object.`,
    { field: label },
  );
  for (const field of Object.keys(value)) {
    invariant(
      allowed.includes(field),
      'CANDIDATE_MANIFEST_FIELD_FORBIDDEN',
      `${label}.${field} is not permitted.`,
      { field: `${label}.${field}` },
    );
  }
  return value;
}

function requireString(value, label, { min = 1, max = 2048, machinePathSafe = false } = {}) {
  invariant(
    typeof value === 'string'
      && value.length >= min
      && value.length <= max
      && value.trim() === value
      && !CONTROL_CHARACTER_PATTERN.test(value),
    'CANDIDATE_MANIFEST_INVALID',
    `${label} must be a bounded trimmed string without control characters.`,
    { field: label },
  );
  invariant(
    !machinePathSafe || !MACHINE_PATH_PATTERN.test(value),
    'CANDIDATE_MANIFEST_INVALID',
    `${label} must not contain a machine-local path.`,
    { field: label },
  );
  return value;
}

function requireInteger(value, label, { min = Number.MIN_SAFE_INTEGER } = {}) {
  invariant(
    Number.isSafeInteger(value) && value >= min,
    'CANDIDATE_MANIFEST_INVALID',
    `${label} must be a safe integer greater than or equal to ${min}.`,
    { field: label, value, min },
  );
  return value;
}

function requireHash(value, label) {
  invariant(
    typeof value === 'string' && HASH_PATTERN.test(value),
    'CANDIDATE_MANIFEST_INVALID',
    `${label} must be a lowercase SHA-256 digest.`,
    { field: label },
  );
  return value;
}

function requireToken(value, label) {
  const token = requireString(value, label, { max: 64 });
  invariant(
    TOKEN_PATTERN.test(token),
    'CANDIDATE_MANIFEST_INVALID',
    `${label} must be a lowercase capability token.`,
    { field: label, value: token },
  );
  return token;
}

function requireNamespacedId(value, label) {
  const id = requireString(value, label, { max: 128 });
  invariant(
    NAMESPACED_ID_PATTERN.test(id),
    'CANDIDATE_MANIFEST_INVALID',
    `${label} must be a lowercase dotted identifier.`,
    { field: label, value: id },
  );
  return id;
}

function requireId(value, label) {
  const id = requireString(value, label, { max: 128 });
  invariant(
    ID_PATTERN.test(id),
    'CANDIDATE_MANIFEST_INVALID',
    `${label} must be a safe stable identifier.`,
    { field: label, value: id },
  );
  return id;
}

function requireStableReference(value, label) {
  const reference = requireString(value, label, { max: 256 });
  invariant(
    STABLE_REFERENCE_PATTERN.test(reference),
    'CANDIDATE_MANIFEST_INVALID',
    `${label} must be a safe stable reference.`,
    { field: label, value: reference },
  );
  return reference;
}

function requireMediaType(value, label) {
  const mediaType = requireString(value, label, { max: 128 }).toLowerCase();
  invariant(
    MEDIA_TYPE_PATTERN.test(mediaType),
    'CANDIDATE_MANIFEST_INVALID',
    `${label} must be a normalized media type.`,
    { field: label, value: mediaType },
  );
  return mediaType;
}

function requireArray(value, label, { min = 0, max = 4096 } = {}) {
  invariant(
    Array.isArray(value) && value.length >= min && value.length <= max,
    'CANDIDATE_MANIFEST_INVALID',
    `${label} must contain between ${min} and ${max} entries.`,
    { field: label, min, max },
  );
  return value;
}

function sortedUnique(values, label, normalizer, identity, options = {}) {
  const normalized = requireArray(values, label, options)
    .map((value, index) => normalizer(value, `${label}[${index}]`));
  const seen = new Set();
  for (const value of normalized) {
    const key = identity(value);
    invariant(
      !seen.has(key),
      'CANDIDATE_MANIFEST_DUPLICATE',
      `${label} contains duplicate identity ${key}.`,
      { field: label, identity: key },
    );
    seen.add(key);
  }
  return normalized.sort((left, right) => identity(left).localeCompare(identity(right)));
}

function normalizeLogicalPath(value, label) {
  const path = requireString(value, label, { max: 1024 });
  invariant(
    !path.startsWith('/') && !path.startsWith('\\') && !/^[A-Za-z]:/.test(path),
    'CANDIDATE_MANIFEST_PATH_UNSAFE',
    `${label} must be candidate-relative.`,
    { field: label, path },
  );
  invariant(
    !path.includes('\\') && !path.includes('//'),
    'CANDIDATE_MANIFEST_PATH_UNSAFE',
    `${label} must use normalized forward slashes.`,
    { field: label, path },
  );
  const segments = path.split('/');
  invariant(
    segments.every((segment) => (
      segment !== '.'
        && segment !== '..'
        && LOGICAL_PATH_SEGMENT_PATTERN.test(segment)
        && !segment.endsWith('.')
    )),
    'CANDIDATE_MANIFEST_PATH_UNSAFE',
    `${label} contains an unsafe path segment.`,
    { field: label, path },
  );
  return path;
}

function normalizeSemanticRevision(value, label) {
  const revision = exactFields(value, ['kind', 'id', 'revision', 'fingerprint'], label);
  return {
    kind: requireToken(revision.kind, `${label}.kind`),
    id: requireId(revision.id, `${label}.id`),
    revision: requireInteger(revision.revision, `${label}.revision`, { min: 1 }),
    fingerprint: revision.fingerprint === null
      ? null
      : requireHash(revision.fingerprint, `${label}.fingerprint`),
  };
}

function normalizeVersionPin(value, label) {
  const pin = exactFields(value, ['id', 'version', 'fingerprint'], label);
  return {
    id: requireId(pin.id, `${label}.id`),
    version: requireInteger(pin.version, `${label}.version`, { min: 1 }),
    fingerprint: requireHash(pin.fingerprint, `${label}.fingerprint`),
  };
}

function normalizeArtifact(value, label) {
  const artifact = exactFields(value, [
    'artifactUri', 'sha256', 'mediaType', 'byteSize', 'role', 'provenanceRef',
  ], label);
  const sha256 = requireHash(artifact.sha256, `${label}.sha256`);
  const artifactUri = requireString(artifact.artifactUri, `${label}.artifactUri`, { max: 128 });
  const match = CAS_URI_PATTERN.exec(artifactUri);
  invariant(
    match?.[1] === sha256,
    'CANDIDATE_MANIFEST_INVALID',
    `${label}.artifactUri must be the canonical Studio CAS URI for its digest.`,
    { field: `${label}.artifactUri`, sha256 },
  );
  return {
    artifactUri,
    sha256,
    mediaType: requireMediaType(artifact.mediaType, `${label}.mediaType`),
    byteSize: requireInteger(artifact.byteSize, `${label}.byteSize`, { min: 0 }),
    role: requireToken(artifact.role, `${label}.role`),
    provenanceRef: requireStableReference(artifact.provenanceRef, `${label}.provenanceRef`),
  };
}

function normalizeOutput(value, label) {
  const output = exactFields(value, [
    'kind', 'logicalPath', 'mediaType', 'byteSize', 'sha256', 'role',
  ], label);
  invariant(
    output.kind === 'file',
    'CANDIDATE_MANIFEST_SCHEMA_UNSUPPORTED',
    'Candidate manifest schema v1 supports file outputs only.',
    { field: `${label}.kind`, value: output.kind },
  );
  return {
    kind: 'file',
    logicalPath: normalizeLogicalPath(output.logicalPath, `${label}.logicalPath`),
    mediaType: requireMediaType(output.mediaType, `${label}.mediaType`),
    byteSize: requireInteger(output.byteSize, `${label}.byteSize`, { min: 0 }),
    sha256: requireHash(output.sha256, `${label}.sha256`),
    role: requireToken(output.role, `${label}.role`),
  };
}

function normalizeFinding(value, label) {
  const finding = exactFields(value, [
    'severity', 'ruleId', 'objectRef', 'explanation', 'remediation', 'validatorVersion',
  ], label);
  invariant(
    Object.hasOwn(SEVERITY_ORDER, finding.severity),
    'CANDIDATE_MANIFEST_INVALID',
    `${label}.severity is unsupported.`,
    { field: `${label}.severity`, value: finding.severity },
  );
  return {
    severity: finding.severity,
    ruleId: requireNamespacedId(finding.ruleId, `${label}.ruleId`),
    objectRef: requireStableReference(finding.objectRef, `${label}.objectRef`),
    explanation: requireString(finding.explanation, `${label}.explanation`, {
      max: 2000,
      machinePathSafe: true,
    }),
    remediation: requireString(finding.remediation, `${label}.remediation`, {
      max: 2000,
      machinePathSafe: true,
    }),
    validatorVersion: requireString(finding.validatorVersion, `${label}.validatorVersion`, { max: 256 }),
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function validateCandidateManifest(value) {
  const manifest = exactFields(value, [
    'schemaVersion', 'kind', 'status', 'project', 'snapshot', 'capabilityProfile',
    'adapter', 'compiler', 'semanticRevisions', 'requirements', 'recipes',
    'artifacts', 'outputs', 'findings', 'stages',
  ], 'manifest');
  invariant(
    manifest.schemaVersion === CANDIDATE_MANIFEST_SCHEMA_VERSION,
    'CANDIDATE_MANIFEST_SCHEMA_UNSUPPORTED',
    'Unsupported candidate manifest schema version.',
    { value: manifest.schemaVersion },
  );
  invariant(
    manifest.kind === CANDIDATE_MANIFEST_KIND,
    'CANDIDATE_MANIFEST_INVALID',
    'Candidate manifest kind is invalid.',
    { value: manifest.kind },
  );
  invariant(
    CANDIDATE_STATUSES.includes(manifest.status),
    'CANDIDATE_MANIFEST_INVALID',
    'Candidate status is invalid.',
    { value: manifest.status },
  );

  const project = exactFields(manifest.project, ['projectId', 'revision'], 'project');
  const snapshot = exactFields(manifest.snapshot, ['snapshotId'], 'snapshot');
  const profile = exactFields(manifest.capabilityProfile, [
    'profileId', 'profileVersion', 'fingerprint',
  ], 'capabilityProfile');
  const adapter = exactFields(manifest.adapter, ['id', 'version', 'candidateHash'], 'adapter');
  const compiler = exactFields(manifest.compiler, [
    'id', 'version', 'status', 'evidenceHash',
  ], 'compiler');
  invariant(
    CANDIDATE_COMPILER_STATUSES.includes(compiler.status),
    'CANDIDATE_MANIFEST_INVALID',
    'Compiler status is invalid.',
    { value: compiler.status },
  );
  const stages = exactFields(manifest.stages, [
    'candidate', 'materialize', 'commit', 'publish',
  ], 'stages');
  invariant(
    stages.candidate === manifest.status,
    'CANDIDATE_MANIFEST_INVALID',
    'Candidate stage must match the candidate status.',
  );
  for (const stage of ['materialize', 'commit', 'publish']) {
    invariant(
      stages[stage] === 'NOT_AUTHORIZED',
      'CANDIDATE_MANIFEST_AUTHORITY_FORBIDDEN',
      `A candidate manifest cannot grant ${stage} authority.`,
      { field: `stages.${stage}`, value: stages[stage] },
    );
  }

  const semanticRevisions = sortedUnique(
    manifest.semanticRevisions,
    'semanticRevisions',
    normalizeSemanticRevision,
    (entry) => `${entry.kind}:${entry.id}@${entry.revision}`,
    { min: 1 },
  );
  const requirements = sortedUnique(
    manifest.requirements,
    'requirements',
    normalizeVersionPin,
    (entry) => `${entry.id}@${entry.version}`,
  );
  const recipes = sortedUnique(
    manifest.recipes,
    'recipes',
    normalizeVersionPin,
    (entry) => `${entry.id}@${entry.version}`,
  );
  const artifacts = sortedUnique(
    manifest.artifacts,
    'artifacts',
    normalizeArtifact,
    (entry) => entry.artifactUri,
  );
  const outputs = sortedUnique(
    manifest.outputs,
    'outputs',
    normalizeOutput,
    (entry) => entry.logicalPath.toLocaleLowerCase('en-US'),
    { min: 1 },
  );
  const findings = requireArray(manifest.findings, 'findings')
    .map((finding, index) => normalizeFinding(finding, `findings[${index}]`));
  const findingIdentities = new Set();
  for (const finding of findings) {
    const identity = `${finding.ruleId}:${finding.objectRef}:${finding.explanation}`;
    invariant(
      !findingIdentities.has(identity),
      'CANDIDATE_MANIFEST_DUPLICATE',
      `findings contains duplicate identity ${identity}.`,
      { field: 'findings', identity },
    );
    findingIdentities.add(identity);
  }
  findings.sort((left, right) => (
    SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]
      || left.ruleId.localeCompare(right.ruleId)
      || left.objectRef.localeCompare(right.objectRef)
      || left.explanation.localeCompare(right.explanation)
  ));
  invariant(
    manifest.status !== 'VERIFIED'
      || (compiler.status === 'SUCCEEDED' && !findings.some((finding) => finding.severity === 'ERROR')),
    'CANDIDATE_MANIFEST_INVALID',
    'A verified candidate requires successful compiler evidence and no error findings.',
  );

  return deepFreeze({
    schemaVersion: CANDIDATE_MANIFEST_SCHEMA_VERSION,
    kind: CANDIDATE_MANIFEST_KIND,
    status: manifest.status,
    project: {
      projectId: requireId(project.projectId, 'project.projectId'),
      revision: requireInteger(project.revision, 'project.revision', { min: 1 }),
    },
    snapshot: { snapshotId: requireHash(snapshot.snapshotId, 'snapshot.snapshotId') },
    capabilityProfile: {
      profileId: requireNamespacedId(profile.profileId, 'capabilityProfile.profileId'),
      profileVersion: requireInteger(profile.profileVersion, 'capabilityProfile.profileVersion', { min: 1 }),
      fingerprint: requireHash(profile.fingerprint, 'capabilityProfile.fingerprint'),
    },
    adapter: {
      id: requireToken(adapter.id, 'adapter.id'),
      version: requireString(adapter.version, 'adapter.version', { max: 256 }),
      candidateHash: requireHash(adapter.candidateHash, 'adapter.candidateHash'),
    },
    compiler: {
      id: requireNamespacedId(compiler.id, 'compiler.id'),
      version: requireString(compiler.version, 'compiler.version', { max: 256 }),
      status: compiler.status,
      evidenceHash: compiler.evidenceHash === null
        ? null
        : requireHash(compiler.evidenceHash, 'compiler.evidenceHash'),
    },
    semanticRevisions,
    requirements,
    recipes,
    artifacts,
    outputs,
    findings,
    stages: {
      candidate: manifest.status,
      materialize: 'NOT_AUTHORIZED',
      commit: 'NOT_AUTHORIZED',
      publish: 'NOT_AUTHORIZED',
    },
  });
}

export function canonicalCandidateManifestJson(value) {
  return `${JSON.stringify(canonicalize(validateCandidateManifest(value)), null, 2)}\n`;
}

export function candidateManifestSha256(value) {
  return createHash('sha256').update(canonicalCandidateManifestJson(value)).digest('hex');
}
