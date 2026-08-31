import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  StudioError,
  createTaskCandidateDiff,
  createTaskCandidatePayload,
  createTaskCandidatePreview,
  createTaskCandidateSubmission,
  taskCandidateOutputClosureSha256,
  taskCandidateSha256,
  validateTaskCandidateDiff,
  validateTaskCandidatePayload,
  validateTaskCandidateSubmission,
} from '../packages/domain/src/index.js';

const hash = (value) => createHash('sha256').update(value).digest('hex');

function outputFixture() {
  const content = '{\n  "candidate": "a4b-key-reference"\n}\n';
  return [{
    logicalPath: 'numberdroid/a4b-key-reference.json',
    mediaType: 'application/json',
    byteSize: Buffer.byteLength(content),
    sha256: hash(content),
    role: 'candidate-text',
    content,
  }];
}

function manifestFixture(outputs = outputFixture()) {
  return {
    schemaVersion: 1,
    kind: 'studio.candidate-manifest',
    status: 'VERIFIED',
    project: { projectId: 'project.a4c', revision: 3 },
    snapshot: { snapshotId: '1'.repeat(64) },
    capabilityProfile: {
      profileId: 'numberdroid.a4b',
      profileVersion: 3,
      fingerprint: '2'.repeat(64),
    },
    adapter: {
      id: 'numberdroid',
      version: 'numberdroid-studio.adapter.v1',
      candidateHash: 'b'.repeat(64),
    },
    compiler: {
      id: 'numberdroid.level-compiler',
      version: `numberdroid-level-compiler.sha256:${'3'.repeat(64)}`,
      status: 'SUCCEEDED',
      evidenceHash: '4'.repeat(64),
    },
    semanticRevisions: [{
      kind: 'task-command',
      id: 'cmd.a4c.level-candidate',
      revision: 3,
      fingerprint: '5'.repeat(64),
    }],
    requirements: [],
    recipes: [],
    artifacts: [],
    outputs: outputs.map(({ content: _content, ...output }) => ({ kind: 'file', ...output })),
    findings: [{
      severity: 'WARNING',
      ruleId: 'numberdroid.requirement.trace-missing',
      objectRef: 'levelSpec:a4b-key-reference',
      explanation: 'The bounded A4b fixture retains its known missing authored trace.',
      remediation: 'Keep the warning visible for human review.',
      validatorVersion: 'studio.level-authoring-validator.v1',
    }],
    stages: {
      candidate: 'VERIFIED',
      materialize: 'NOT_AUTHORIZED',
      commit: 'NOT_AUTHORIZED',
      publish: 'NOT_AUTHORIZED',
    },
  };
}

function submissionFixture() {
  const outputs = outputFixture();
  const candidate = createTaskCandidatePayload({
    candidateManifest: manifestFixture(outputs),
    outputs,
  });
  const preview = createTaskCandidatePreview({
    candidateFingerprint: candidate.candidateFingerprint,
    title: 'A4b key reference',
    summary: 'One bounded Actor-defeated to visible-text candidate.',
    facts: [
      { factId: 'actor', label: 'Actor', value: 'guard-actor' },
      { factId: 'route', label: 'Route', value: 'guard-route' },
      { factId: 'pickup', label: 'Initially hidden pickup', value: 'guard-key' },
      { factId: 'variable', label: 'Boolean', value: 'state.guard-key-collected = false' },
      { factId: 'text', label: 'Visible text', value: '<SYSTEM> WÄCHTER-ZUGANG GESICHERT' },
    ],
    steps: [
      { sequence: 1, triggerKind: 'actor-defeated', triggerRef: 'trigger.guard-defeated', actionKind: 'drop-item', actionRef: 'action.drop-guard-key', targetRef: 'guard-key' },
      { sequence: 2, triggerKind: 'collect', triggerRef: 'trigger.guard-key-collected', actionKind: 'set-variable', actionRef: 'action.set-guard-key-state', targetRef: 'state.guard-key-collected' },
      { sequence: 3, triggerKind: 'state-change', triggerRef: 'trigger.guard-key-state', actionKind: 'show-text', actionRef: 'action.show-guard-key-text', targetRef: 'text.guard-key-collected' },
    ],
  });
  const diff = createTaskCandidateDiff({
    projectId: 'project.a4c',
    taskId: 'task.a4c',
    branchId: 'branch.task.a4c',
    baseRevision: 2,
    branchHeadRevision: 3,
    candidateFingerprint: candidate.candidateFingerprint,
    changes: [{
      changeId: 'candidate.a4b.created',
      operation: 'ADD',
      objectKind: 'level-candidate',
      objectRef: 'candidate.a4b',
      summary: 'Create the bounded A4b level candidate.',
    }],
    outputs: outputs.map((output) => ({
      logicalPath: output.logicalPath,
      operation: 'ADD',
      beforeSha256: null,
      afterSha256: output.sha256,
    })),
  });
  return createTaskCandidateSubmission({
    submissionId: 'submission.a4c',
    idempotencyKeyHash: '6'.repeat(64),
    projectId: 'project.a4c',
    taskId: 'task.a4c',
    branchId: 'branch.task.a4c',
    baseRevision: 2,
    branchHeadRevision: 3,
    projectionFingerprint: '7'.repeat(64),
    candidate,
    preview,
    diff,
    compilerPins: [
      { id: 'numberdroid.semantic-compiler', version: `numberdroid-level-compiler.sha256:${'3'.repeat(64)}`, evidenceHash: '4'.repeat(64) },
      { id: 'numberdroid.runtime-compiler', version: `numberdroid-runtime-compiler.sha256:${'8'.repeat(64)}`, evidenceHash: '9'.repeat(64) },
    ],
    engineBridgeReceipt: {
      schemaVersion: 1,
      kind: 'studio.engine-bridge.validation-receipt',
      status: 'VALIDATED',
      bridge: { id: 'numberdroid.a4c-validator', version: 'numberdroid.a4c-validator.v1' },
      candidateFingerprint: candidate.candidateFingerprint,
      evidenceHash: 'a'.repeat(64),
    },
  });
}

function expectCode(action, code) {
  assert.throws(action, (error) => error instanceof StudioError && error.code === code);
}

test('task-candidate submission is deterministic, restart-portable, and deeply immutable', () => {
  const submission = submissionFixture();
  const restarted = validateTaskCandidateSubmission(JSON.parse(JSON.stringify(submission)));
  assert.deepEqual(restarted, submission);
  assert.equal(taskCandidateSha256(restarted), submission.fingerprint);
  assert.ok(Object.isFrozen(submission));
  assert.ok(Object.isFrozen(submission.candidate.outputs[0]));
  assert.ok(Object.isFrozen(submission.preview.steps[0]));
  assert.ok(Object.isFrozen(submission.diff.outputs[0]));
  assert.equal(
    submission.candidate.outputClosureFingerprint,
    taskCandidateOutputClosureSha256(submission.candidate.outputs),
  );
  assert.equal(submission.status, 'WAITING_FOR_HUMAN_REVIEW');
  assert.deepEqual(new Set(Object.values(submission.authority)), new Set(['NOT_AUTHORIZED']));
});

test('task-candidate submission binds exact output bytes, manifest, preview, diff, and bridge receipt', () => {
  const contentTamper = structuredClone(submissionFixture().candidate);
  contentTamper.outputs[0].content += 'tamper';
  expectCode(() => validateTaskCandidatePayload(contentTamper), 'TASK_CANDIDATE_OUTPUT_MISMATCH');

  const manifestTamper = structuredClone(submissionFixture().candidate);
  manifestTamper.candidateManifest.adapter.candidateHash = 'f'.repeat(64);
  expectCode(() => validateTaskCandidatePayload(manifestTamper), 'TASK_CANDIDATE_FINGERPRINT_MISMATCH');

  const diffTamper = structuredClone(submissionFixture());
  diffTamper.diff.outputs[0].afterSha256 = 'f'.repeat(64);
  const { fingerprint: _staleFingerprint, ...diffCore } = diffTamper.diff;
  diffTamper.diff = createTaskCandidateDiff(diffCore);
  expectCode(() => validateTaskCandidateSubmission(diffTamper), 'TASK_CANDIDATE_BINDING_MISMATCH');

  const bridgeTamper = structuredClone(submissionFixture());
  bridgeTamper.engineBridgeReceipt.candidateFingerprint = 'f'.repeat(64);
  expectCode(() => validateTaskCandidateSubmission(bridgeTamper), 'TASK_CANDIDATE_FINGERPRINT_MISMATCH');
});

test('task-candidate v1 rejects missing payload closure, unsafe paths, and later-stage authority', () => {
  const externalArtifact = structuredClone(submissionFixture().candidate);
  externalArtifact.candidateManifest.artifacts.push({
    artifactUri: `studio://artifacts/sha256/${'b'.repeat(64)}`,
    sha256: 'b'.repeat(64),
    mediaType: 'image/png',
    byteSize: 1,
    role: 'source',
    provenanceRef: 'source.a4c',
  });
  expectCode(() => validateTaskCandidatePayload(externalArtifact), 'TASK_CANDIDATE_ARTIFACT_UNSUPPORTED');

  const unsafeDiff = structuredClone(submissionFixture().diff);
  unsafeDiff.outputs[0].logicalPath = '../outside.json';
  expectCode(() => createTaskCandidateDiff(unsafeDiff), 'TASK_CANDIDATE_PATH_UNSAFE');

  const authority = structuredClone(submissionFixture());
  authority.authority.merge = 'AUTHORIZED';
  expectCode(() => validateTaskCandidateSubmission(authority), 'TASK_CANDIDATE_AUTHORITY_FORBIDDEN');
});

test('task-candidate validators reject proxy, accessor, cycle, and sparse-array inputs without invoking code', () => {
  const submission = structuredClone(submissionFixture());
  expectCode(() => validateTaskCandidateSubmission(new Proxy(submission, {})), 'TASK_CANDIDATE_INPUT_INVALID');

  let getterCalls = 0;
  const accessor = structuredClone(submissionFixture());
  Object.defineProperty(accessor, 'taskId', { enumerable: true, get() { getterCalls += 1; return 'task.evil'; } });
  expectCode(() => validateTaskCandidateSubmission(accessor), 'TASK_CANDIDATE_INPUT_INVALID');
  assert.equal(getterCalls, 0);

  const cycle = structuredClone(submissionFixture());
  cycle.loop = cycle;
  expectCode(() => validateTaskCandidateSubmission(cycle), 'TASK_CANDIDATE_INPUT_INVALID');

  const sparse = structuredClone(submissionFixture());
  sparse.preview.facts = new Array(1);
  expectCode(() => validateTaskCandidateSubmission(sparse), 'TASK_CANDIDATE_INPUT_INVALID');
});
