import assert from 'node:assert/strict';
import test from 'node:test';
import * as application from '../packages/application/src/index.js';
import {
  ENGINE_BRIDGE_CANDIDATE_SELECTION_KIND,
  ENGINE_BRIDGE_PORT_DIRECTION,
  ENGINE_BRIDGE_PORT_KIND,
  ENGINE_BRIDGE_PORT_MODE,
  ENGINE_BRIDGE_PORT_SCHEMA_VERSION,
  ENGINE_BRIDGE_VALIDATION_RECEIPT_KIND,
  createEngineBridgeCandidateSelection,
  validateCandidateWithEngineBridge,
  validateEngineBridgeCandidateSelection,
  validateEngineBridgePort,
} from '../packages/application/src/index.js';
import {
  StudioError,
  candidateManifestSha256,
} from '../packages/domain/src/index.js';

const hashes = Object.freeze({
  snapshot: '1'.repeat(64),
  profile: '2'.repeat(64),
  adapterCandidate: '3'.repeat(64),
  compiler: '4'.repeat(64),
  room: '5'.repeat(64),
  output: '6'.repeat(64),
  bridgeEvidence: '7'.repeat(64),
});

function candidateManifest({ status = 'VERIFIED' } = {}) {
  return {
    schemaVersion: 1,
    kind: 'studio.candidate-manifest',
    status,
    project: { projectId: 'project.engine-bridge', revision: 7 },
    snapshot: { snapshotId: hashes.snapshot },
    capabilityProfile: {
      profileId: 'fixture.engine-bridge',
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
      { kind: 'room-variant', id: 'room.engine-bridge', revision: 3, fingerprint: hashes.room },
    ],
    requirements: [],
    recipes: [],
    artifacts: [],
    outputs: [{
      kind: 'file',
      logicalPath: 'src/engine-bridge.json',
      mediaType: 'application/json',
      byteSize: 128,
      sha256: hashes.output,
      role: 'candidate-text',
    }],
    findings: [],
    stages: {
      candidate: status,
      materialize: 'NOT_AUTHORIZED',
      commit: 'NOT_AUTHORIZED',
      publish: 'NOT_AUTHORIZED',
    },
  };
}

function engineBridge(validateCandidate) {
  return {
    schemaVersion: ENGINE_BRIDGE_PORT_SCHEMA_VERSION,
    kind: ENGINE_BRIDGE_PORT_KIND,
    mode: ENGINE_BRIDGE_PORT_MODE,
    direction: ENGINE_BRIDGE_PORT_DIRECTION,
    bridge: { id: 'fixture.engine-bridge', version: 'fixture.engine-bridge.v1' },
    validateCandidate,
  };
}

function validationReceipt(selection, overrides = {}) {
  return {
    schemaVersion: ENGINE_BRIDGE_PORT_SCHEMA_VERSION,
    kind: ENGINE_BRIDGE_VALIDATION_RECEIPT_KIND,
    status: 'VALIDATED',
    bridge: { id: 'fixture.engine-bridge', version: 'fixture.engine-bridge.v1' },
    candidateFingerprint: selection.candidateFingerprint,
    evidenceHash: hashes.bridgeEvidence,
    ...overrides,
  };
}

function throwsCode(operation, code) {
  assert.throws(
    operation,
    (error) => error instanceof StudioError && error.code === code,
  );
}

test('EngineBridge candidate selection pins one verified immutable manifest without authority', () => {
  const input = candidateManifest();
  const selection = createEngineBridgeCandidateSelection(input);
  input.project.revision = 99;

  assert.deepEqual(selection, {
    schemaVersion: 1,
    kind: ENGINE_BRIDGE_CANDIDATE_SELECTION_KIND,
    candidateFingerprint: candidateManifestSha256(candidateManifest()),
    candidateManifest: candidateManifest(),
  });
  assert.ok(Object.isFrozen(selection));
  assert.ok(Object.isFrozen(selection.candidateManifest));
  assert.ok(Object.isFrozen(selection.candidateManifest.outputs[0]));
  assert.equal(selection.candidateManifest.project.revision, 7);
  for (const stage of ['materialize', 'commit', 'publish']) {
    assert.equal(selection.candidateManifest.stages[stage], 'NOT_AUTHORIZED');
  }
});

test('validate-only EngineBridge returns a pinned frozen receipt and sees no destination or authority context', async () => {
  const calls = [];
  const selection = createEngineBridgeCandidateSelection(candidateManifest());
  const bridge = engineBridge(async (receivedSelection, context) => {
    calls.push({ receivedSelection, context });
    return validationReceipt(receivedSelection);
  });
  const receipt = await validateCandidateWithEngineBridge(bridge, selection);

  assert.deepEqual(receipt, validationReceipt(selection));
  assert.ok(Object.isFrozen(receipt));
  assert.ok(Object.isFrozen(receipt.bridge));
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].receivedSelection, selection);
  assert.notEqual(calls[0].receivedSelection, selection);
  assert.ok(Object.isFrozen(calls[0].receivedSelection));
  assert.deepEqual(calls[0].context, { signal: undefined });
  assert.ok(Object.isFrozen(calls[0].context));
  assert.deepEqual(Object.keys(calls[0].context), ['signal']);
});

test('EngineBridge v1 rejects write, release, destination, approval, and round-trip surface additions', () => {
  const base = engineBridge(async () => undefined);
  for (const field of [
    'destination', 'materializeCandidate', 'commitCandidate', 'publishCandidate',
    'approveCandidate', 'roundTripCandidate',
  ]) {
    throwsCode(
      () => validateEngineBridgePort({ ...base, [field]: () => undefined }),
      'ENGINE_BRIDGE_FIELD_FORBIDDEN',
    );
  }
  for (const exportName of [
    'materializeCandidate', 'commitCandidate', 'publishCandidate', 'approveCandidate',
  ]) {
    assert.equal(application[exportName], undefined);
  }
});

test('EngineBridge schemas, direction, verified status, and fingerprints fail closed', () => {
  const base = engineBridge(async () => undefined);
  throwsCode(
    () => validateEngineBridgePort({ ...base, schemaVersion: 2 }),
    'ENGINE_BRIDGE_SCHEMA_UNSUPPORTED',
  );
  throwsCode(
    () => validateEngineBridgePort({ ...base, mode: 'MATERIALIZE' }),
    'ENGINE_BRIDGE_INVALID',
  );
  throwsCode(
    () => validateEngineBridgePort({ ...base, direction: 'ROUND_TRIP' }),
    'ENGINE_BRIDGE_INVALID',
  );
  throwsCode(
    () => validateEngineBridgePort({
      ...base,
      bridge: { ...base.bridge, version: '/home/designer/bridge.js' },
    }),
    'ENGINE_BRIDGE_INVALID',
  );
  throwsCode(
    () => createEngineBridgeCandidateSelection(candidateManifest({ status: 'BLOCKED' })),
    'ENGINE_BRIDGE_CANDIDATE_NOT_VERIFIED',
  );

  const selection = createEngineBridgeCandidateSelection(candidateManifest());
  throwsCode(
    () => validateEngineBridgeCandidateSelection({ ...selection, schemaVersion: 2 }),
    'ENGINE_BRIDGE_SCHEMA_UNSUPPORTED',
  );
  throwsCode(
    () => validateEngineBridgeCandidateSelection({ ...selection, candidateFingerprint: '0'.repeat(64) }),
    'ENGINE_BRIDGE_CANDIDATE_FINGERPRINT_MISMATCH',
  );
  throwsCode(
    () => validateEngineBridgeCandidateSelection({ ...selection, destination: '/tmp/project' }),
    'ENGINE_BRIDGE_FIELD_FORBIDDEN',
  );
});

test('EngineBridge receipts cannot substitute a bridge, candidate, evidence digest, or extra operation', async () => {
  const selection = createEngineBridgeCandidateSelection(candidateManifest());
  const cases = [
    [validationReceipt(selection, { bridge: { id: 'other.engine-bridge', version: 'v1' } }), 'ENGINE_BRIDGE_RECEIPT_MISMATCH'],
    [validationReceipt(selection, { candidateFingerprint: '0'.repeat(64) }), 'ENGINE_BRIDGE_RECEIPT_MISMATCH'],
    [validationReceipt(selection, { evidenceHash: 'invalid' }), 'ENGINE_BRIDGE_INVALID'],
    [validationReceipt(selection, { destination: '/tmp/project' }), 'ENGINE_BRIDGE_FIELD_FORBIDDEN'],
  ];
  for (const [receipt, code] of cases) {
    await assert.rejects(
      validateCandidateWithEngineBridge(engineBridge(async () => receipt), selection),
      (error) => error instanceof StudioError && error.code === code,
    );
  }
});

test('EngineBridge adapter failures are sanitized and do not leak machine-local details', async () => {
  const selection = createEngineBridgeCandidateSelection(candidateManifest());
  await assert.rejects(
    validateCandidateWithEngineBridge(engineBridge(async () => {
      throw new Error('Failed at /home/designer/private/project.json');
    }), selection),
    (error) => {
      assert.ok(error instanceof StudioError);
      assert.equal(error.code, 'ENGINE_BRIDGE_VALIDATION_FAILED');
      assert.doesNotMatch(JSON.stringify(error), /home|designer|project\.json/i);
      return true;
    },
  );
});
