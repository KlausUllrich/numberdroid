import assert from 'node:assert/strict';
import test from 'node:test';
import {
  StudioError,
  candidateManifestSha256,
  canonicalCandidateManifestJson,
  validateCandidateManifest,
} from '../packages/domain/src/index.js';

const hashes = Object.freeze({
  snapshot: '1'.repeat(64),
  profile: '2'.repeat(64),
  adapterCandidate: '3'.repeat(64),
  compiler: '4'.repeat(64),
  room: '5'.repeat(64),
  requirements: '6'.repeat(64),
  recipe: '7'.repeat(64),
  source: '8'.repeat(64),
  derived: '9'.repeat(64),
  output: 'a'.repeat(64),
  outputTwo: 'b'.repeat(64),
});

function manifestFixture() {
  return {
    schemaVersion: 1,
    kind: 'studio.candidate-manifest',
    status: 'BLOCKED',
    project: { projectId: 'project.contract', revision: 7 },
    snapshot: { snapshotId: hashes.snapshot },
    capabilityProfile: {
      profileId: 'fixture.contract',
      profileVersion: 1,
      fingerprint: hashes.profile,
    },
    adapter: {
      id: 'fixture',
      version: 'fixture.adapter.v1',
      candidateHash: hashes.adapterCandidate,
    },
    compiler: {
      id: 'fixture.compiler',
      version: 'fixture.compiler.v1',
      status: 'SUCCEEDED',
      evidenceHash: hashes.compiler,
    },
    semanticRevisions: [
      { kind: 'room-variant', id: 'room.contract', revision: 3, fingerprint: hashes.room },
      { kind: 'room-archetype', id: 'archetype.contract', revision: 1, fingerprint: null },
    ],
    requirements: [
      { id: 'requirements.contract', version: 2, fingerprint: hashes.requirements },
    ],
    recipes: [
      { id: 'recipe.contract', version: 4, fingerprint: hashes.recipe },
    ],
    artifacts: [
      {
        artifactUri: `studio://artifacts/sha256/${hashes.source}`,
        sha256: hashes.source,
        mediaType: 'image/png',
        byteSize: 64,
        role: 'source',
        provenanceRef: 'source.contract',
      },
      {
        artifactUri: `studio://artifacts/sha256/${hashes.derived}`,
        sha256: hashes.derived,
        mediaType: 'image/png',
        byteSize: 32,
        role: 'derived',
        provenanceRef: 'recipe.contract@4',
      },
    ],
    outputs: [
      {
        kind: 'file',
        logicalPath: 'public/assets/contract.png',
        mediaType: 'image/png',
        byteSize: 32,
        sha256: hashes.output,
        role: 'runtime',
      },
      {
        kind: 'file',
        logicalPath: 'src/contract.json',
        mediaType: 'application/json',
        byteSize: 128,
        sha256: hashes.outputTwo,
        role: 'candidate-text',
      },
    ],
    findings: [
      {
        severity: 'INFO',
        ruleId: 'fixture.rule.information',
        objectRef: 'room:room.contract@3',
        explanation: 'The fixture retains one informational result.',
        remediation: 'Inspect the pinned evidence.',
        validatorVersion: 'fixture.validator.v1',
      },
      {
        severity: 'ERROR',
        ruleId: 'fixture.rule.blocked',
        objectRef: 'room:room.contract@3',
        explanation: 'The fixture remains deliberately blocked.',
        remediation: 'Resolve the fixture error before verification.',
        validatorVersion: 'fixture.validator.v1',
      },
    ],
    stages: {
      candidate: 'BLOCKED',
      materialize: 'NOT_AUTHORIZED',
      commit: 'NOT_AUTHORIZED',
      publish: 'NOT_AUTHORIZED',
    },
  };
}

function rejectsWithCode(mutator, code) {
  const manifest = manifestFixture();
  mutator(manifest);
  assert.throws(
    () => validateCandidateManifest(manifest),
    (error) => error instanceof StudioError && error.code === code,
  );
}

test('candidate manifest normalization is deterministic, canonical, and deeply immutable', () => {
  const reordered = manifestFixture();
  reordered.semanticRevisions.reverse();
  reordered.artifacts.reverse();
  reordered.outputs.reverse();
  reordered.findings.reverse();
  const normalized = validateCandidateManifest(reordered);
  const original = validateCandidateManifest(manifestFixture());

  assert.deepEqual(normalized, original);
  assert.ok(Object.isFrozen(normalized));
  assert.ok(Object.isFrozen(normalized.outputs));
  assert.ok(Object.isFrozen(normalized.findings[0]));
  assert.equal(canonicalCandidateManifestJson(normalized), canonicalCandidateManifestJson(original));
  assert.equal(candidateManifestSha256(normalized), candidateManifestSha256(original));
  assert.match(candidateManifestSha256(normalized), /^[a-f0-9]{64}$/);
  assert.ok(canonicalCandidateManifestJson(normalized).endsWith('\n'));

  const textOnly = manifestFixture();
  textOnly.artifacts = [];
  assert.deepEqual(validateCandidateManifest(textOnly).artifacts, []);
});

test('candidate manifest rejects unknown versions, fields, output kinds, and unsafe paths', () => {
  rejectsWithCode((manifest) => { manifest.schemaVersion = 2; }, 'CANDIDATE_MANIFEST_SCHEMA_UNSUPPORTED');
  rejectsWithCode((manifest) => { manifest.unknown = true; }, 'CANDIDATE_MANIFEST_FIELD_FORBIDDEN');
  rejectsWithCode((manifest) => { manifest.adapter.unknown = true; }, 'CANDIDATE_MANIFEST_FIELD_FORBIDDEN');
  rejectsWithCode((manifest) => { manifest.outputs[0].kind = 'engine-resource'; }, 'CANDIDATE_MANIFEST_SCHEMA_UNSUPPORTED');
  rejectsWithCode((manifest) => { manifest.outputs[0].logicalPath = '../outside.png'; }, 'CANDIDATE_MANIFEST_PATH_UNSAFE');
  rejectsWithCode((manifest) => { manifest.outputs[0].logicalPath = 'C:\\outside.png'; }, 'CANDIDATE_MANIFEST_PATH_UNSAFE');
  rejectsWithCode((manifest) => { manifest.outputs[0].logicalPath = 'public/unsafe file.png'; }, 'CANDIDATE_MANIFEST_PATH_UNSAFE');
});

test('candidate manifest rejects duplicate identities and mismatched CAS evidence', () => {
  rejectsWithCode((manifest) => { manifest.semanticRevisions.push(structuredClone(manifest.semanticRevisions[0])); }, 'CANDIDATE_MANIFEST_DUPLICATE');
  rejectsWithCode((manifest) => { manifest.artifacts.push(structuredClone(manifest.artifacts[0])); }, 'CANDIDATE_MANIFEST_DUPLICATE');
  rejectsWithCode((manifest) => {
    manifest.outputs[1] = { ...manifest.outputs[0], logicalPath: manifest.outputs[0].logicalPath.toUpperCase() };
  }, 'CANDIDATE_MANIFEST_DUPLICATE');
  rejectsWithCode((manifest) => { manifest.artifacts[0].sha256 = hashes.derived; }, 'CANDIDATE_MANIFEST_INVALID');
});

test('candidate manifest is evidence only and cannot grant later-stage authority', () => {
  for (const stage of ['materialize', 'commit', 'publish']) {
    rejectsWithCode((manifest) => { manifest.stages[stage] = 'AUTHORIZED'; }, 'CANDIDATE_MANIFEST_AUTHORITY_FORBIDDEN');
  }
  rejectsWithCode((manifest) => { manifest.destinationPath = '/tmp/output'; }, 'CANDIDATE_MANIFEST_FIELD_FORBIDDEN');
  rejectsWithCode((manifest) => {
    manifest.findings[0].explanation = 'Leaked from C:\\Users\\designer\\candidate.json';
  }, 'CANDIDATE_MANIFEST_INVALID');
  rejectsWithCode((manifest) => {
    manifest.findings[0].remediation = 'Read /home/designer/private/candidate.json';
  }, 'CANDIDATE_MANIFEST_INVALID');
});

test('verified candidates require successful compiler evidence and no error findings', () => {
  const verified = manifestFixture();
  verified.status = 'VERIFIED';
  verified.stages.candidate = 'VERIFIED';
  verified.findings = verified.findings.filter((finding) => finding.severity !== 'ERROR');
  assert.equal(validateCandidateManifest(verified).status, 'VERIFIED');

  rejectsWithCode((manifest) => {
    manifest.status = 'VERIFIED';
    manifest.stages.candidate = 'VERIFIED';
  }, 'CANDIDATE_MANIFEST_INVALID');
  rejectsWithCode((manifest) => {
    manifest.status = 'VERIFIED';
    manifest.stages.candidate = 'VERIFIED';
    manifest.findings = manifest.findings.filter((finding) => finding.severity !== 'ERROR');
    manifest.compiler.status = 'FAILED';
  }, 'CANDIDATE_MANIFEST_INVALID');
});
