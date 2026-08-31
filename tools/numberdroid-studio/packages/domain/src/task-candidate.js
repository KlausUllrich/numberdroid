import { createHash } from 'node:crypto';
import { types as utilTypes } from 'node:util';
import {
  candidateManifestSha256,
  validateCandidateManifest,
} from './candidate-manifest.js';
import { invariant } from './errors.js';

export const TASK_CANDIDATE_SCHEMA_VERSION = 1;
export const TASK_CANDIDATE_PAYLOAD_KIND = 'studio.task-candidate-payload';
export const TASK_CANDIDATE_PREVIEW_KIND = 'studio.task-candidate-preview';
export const TASK_CANDIDATE_DIFF_KIND = 'studio.task-candidate-diff';
export const TASK_CANDIDATE_SUBMISSION_KIND = 'studio.task-candidate-submission';

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const TOKEN_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@+-]{0,255}$/;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;
const ARRAY_INDEX_PATTERN = /^(?:0|[1-9][0-9]*)$/;
const MAX_DEPTH = 64;
const MAX_ARRAY_ENTRIES = 4_096;
const MAX_OBJECT_FIELDS = 4_096;
const MAX_NODES = 100_000;
const MAX_VALUES = 300_000;
const MAX_STRING_LENGTH = 4_000_000;
const MAX_AGGREGATE_TEXT = 12_000_000;
const MAX_OUTPUTS = 32;
const MAX_OUTPUT_BYTES = 8_000_000;

function snapshotPlainData(value, label = 'value') {
  const state = {
    active: new WeakSet(),
    seen: new WeakSet(),
    nodes: 0,
    values: 0,
    text: 0,
  };

  function inspect(action, path) {
    try {
      return action();
    } catch {
      invariant(false, 'TASK_CANDIDATE_INPUT_INVALID', `${path} could not be inspected safely.`, { field: path });
    }
  }

  function visit(candidate, path, depth) {
    invariant(depth <= MAX_DEPTH, 'TASK_CANDIDATE_LIMIT_EXCEEDED', `${path} exceeds the nesting limit.`, { field: path });
    if (candidate === null || typeof candidate === 'boolean') {
      state.values += 1;
      invariant(state.values <= MAX_VALUES, 'TASK_CANDIDATE_LIMIT_EXCEEDED', 'The candidate contains too many values.');
      return candidate;
    }
    if (typeof candidate === 'number') {
      state.values += 1;
      invariant(Number.isFinite(candidate) && Number.isSafeInteger(candidate) && !Object.is(candidate, -0),
        'TASK_CANDIDATE_INPUT_INVALID', `${path} must be a safe finite integer.`, { field: path });
      return candidate;
    }
    if (typeof candidate === 'string') {
      state.values += 1;
      state.text += candidate.length;
      invariant(candidate.length <= MAX_STRING_LENGTH && state.text <= MAX_AGGREGATE_TEXT,
        'TASK_CANDIDATE_LIMIT_EXCEEDED', `${path} exceeds the text limit.`, { field: path });
      invariant(state.values <= MAX_VALUES, 'TASK_CANDIDATE_LIMIT_EXCEEDED', 'The candidate contains too many values.');
      return candidate;
    }
    invariant(typeof candidate === 'object', 'TASK_CANDIDATE_INPUT_INVALID', `${path} must contain JSON-compatible plain data.`, { field: path });
    invariant(!utilTypes.isProxy(candidate), 'TASK_CANDIDATE_INPUT_INVALID', `${path} may not be a Proxy.`, { field: path });
    invariant(!state.active.has(candidate) && !state.seen.has(candidate),
      'TASK_CANDIDATE_INPUT_INVALID', `${path} may not contain cycles or shared object references.`, { field: path });
    state.active.add(candidate);
    state.seen.add(candidate);
    state.nodes += 1;
    invariant(state.nodes <= MAX_NODES, 'TASK_CANDIDATE_LIMIT_EXCEEDED', 'The candidate contains too many objects.');
    const prototype = inspect(() => Object.getPrototypeOf(candidate), path);
    const keys = inspect(() => Reflect.ownKeys(candidate), path);
    if (Array.isArray(candidate)) {
      invariant(prototype === Array.prototype && candidate.length <= MAX_ARRAY_ENTRIES,
        'TASK_CANDIDATE_INPUT_INVALID', `${path} must be a bounded standard array.`, { field: path });
      for (const key of keys) {
        const index = typeof key === 'string' && ARRAY_INDEX_PATTERN.test(key) ? Number(key) : -1;
        invariant(key === 'length' || (index >= 0 && index < candidate.length),
          'TASK_CANDIDATE_INPUT_INVALID', `${path}.${String(key)} is not a permitted array field.`, { field: `${path}.${String(key)}` });
      }
      const result = [];
      for (let index = 0; index < candidate.length; index += 1) {
        const descriptor = inspect(() => Object.getOwnPropertyDescriptor(candidate, String(index)), `${path}[${index}]`);
        invariant(descriptor?.enumerable && Object.hasOwn(descriptor, 'value'),
          'TASK_CANDIDATE_INPUT_INVALID', `${path} must be dense and contain only data entries.`, { field: `${path}[${index}]` });
        result.push(visit(descriptor.value, `${path}[${index}]`, depth + 1));
      }
      state.active.delete(candidate);
      return result;
    }
    invariant(prototype === Object.prototype || prototype === null,
      'TASK_CANDIDATE_INPUT_INVALID', `${path} must be a plain data object.`, { field: path });
    invariant(keys.length <= MAX_OBJECT_FIELDS, 'TASK_CANDIDATE_LIMIT_EXCEEDED', `${path} contains too many fields.`, { field: path });
    const result = Object.create(null);
    for (const key of keys) {
      invariant(typeof key === 'string' && key.length > 0 && key.length <= 128 && !CONTROL_PATTERN.test(key),
        'TASK_CANDIDATE_INPUT_INVALID', `${path}.${String(key)} is not a safe field name.`, { field: `${path}.${String(key)}` });
      const descriptor = inspect(() => Object.getOwnPropertyDescriptor(candidate, key), `${path}.${key}`);
      invariant(descriptor?.enumerable && Object.hasOwn(descriptor, 'value'),
        'TASK_CANDIDATE_INPUT_INVALID', `${path}.${key} must be an enumerable data field.`, { field: `${path}.${key}` });
      Object.defineProperty(result, key, {
        value: visit(descriptor.value, `${path}.${key}`, depth + 1),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    state.active.delete(candidate);
    return result;
  }

  return visit(value, label, 0);
}

function exactFields(value, allowed, label) {
  invariant(value && typeof value === 'object' && !Array.isArray(value),
    'TASK_CANDIDATE_INPUT_INVALID', `${label} must be an object.`, { field: label });
  for (const key of Object.keys(value)) {
    invariant(allowed.includes(key), 'TASK_CANDIDATE_FIELD_FORBIDDEN', `${label}.${key} is not permitted.`, { field: `${label}.${key}` });
  }
  for (const key of allowed) {
    invariant(Object.hasOwn(value, key), 'TASK_CANDIDATE_INPUT_INVALID', `${label}.${key} is required.`, { field: `${label}.${key}` });
  }
  return value;
}

function requireString(value, label, { min = 1, max = 2_048, controls = false } = {}) {
  invariant(typeof value === 'string' && value.length >= min && value.length <= max
    && (controls || !CONTROL_PATTERN.test(value)),
  'TASK_CANDIDATE_INPUT_INVALID', `${label} must be a bounded string.`, { field: label });
  return value;
}

function requireId(value, label) {
  const result = requireString(value, label, { max: 128 });
  invariant(result.trim() === result && ID_PATTERN.test(result),
    'TASK_CANDIDATE_INPUT_INVALID', `${label} must be a stable identifier.`, { field: label });
  return result;
}

function requireToken(value, label) {
  const result = requireString(value, label, { max: 64 });
  invariant(TOKEN_PATTERN.test(result), 'TASK_CANDIDATE_INPUT_INVALID', `${label} must be a lowercase token.`, { field: label });
  return result;
}

function requireVersion(value, label) {
  const result = requireString(value, label, { max: 256 });
  invariant(VERSION_PATTERN.test(result), 'TASK_CANDIDATE_INPUT_INVALID', `${label} must be a stable version.`, { field: label });
  return result;
}

function requireHash(value, label) {
  invariant(typeof value === 'string' && HASH_PATTERN.test(value),
    'TASK_CANDIDATE_INPUT_INVALID', `${label} must be a lowercase SHA-256 digest.`, { field: label });
  return value;
}

function requireRevision(value, label) {
  invariant(Number.isSafeInteger(value) && value >= 1,
    'TASK_CANDIDATE_INPUT_INVALID', `${label} must be a positive revision.`, { field: label });
  return value;
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

function canonicalJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fingerprintCore(value) {
  const core = { ...value };
  delete core.fingerprint;
  return sha256(canonicalJson(core));
}

function outputClosureFingerprint(outputs) {
  return sha256(canonicalJson(outputs.map(({ content: _content, ...metadata }) => metadata)));
}

function normalizeOutputs(values, manifest) {
  invariant(Array.isArray(values) && values.length >= 1 && values.length <= MAX_OUTPUTS,
    'TASK_CANDIDATE_LIMIT_EXCEEDED', `candidate.outputs must contain between 1 and ${MAX_OUTPUTS} files.`);
  const outputs = values.map((raw, index) => {
    const output = exactFields(raw, ['logicalPath', 'mediaType', 'byteSize', 'sha256', 'role', 'content'], `candidate.outputs[${index}]`);
    const content = requireString(output.content, `candidate.outputs[${index}].content`, { min: 0, max: MAX_OUTPUT_BYTES, controls: true });
    const byteSize = Buffer.byteLength(content);
    invariant(byteSize === output.byteSize && sha256(content) === output.sha256,
      'TASK_CANDIDATE_OUTPUT_MISMATCH', 'Candidate output bytes do not match their declared size and hash.', { logicalPath: output.logicalPath });
    return {
      logicalPath: requireString(output.logicalPath, `candidate.outputs[${index}].logicalPath`, { max: 1_024 }),
      mediaType: requireString(output.mediaType, `candidate.outputs[${index}].mediaType`, { max: 128 }),
      byteSize,
      sha256: requireHash(output.sha256, `candidate.outputs[${index}].sha256`),
      role: requireToken(output.role, `candidate.outputs[${index}].role`),
      content,
    };
  }).sort((left, right) => left.logicalPath.localeCompare(right.logicalPath));
  const folded = new Set(outputs.map(({ logicalPath }) => logicalPath.toLocaleLowerCase('en-US')));
  invariant(folded.size === outputs.length, 'TASK_CANDIDATE_OUTPUT_MISMATCH', 'Candidate output paths collide case-insensitively.');
  const manifestOutputs = manifest.outputs.map(({ kind: _kind, ...output }) => output);
  const descriptors = outputs.map(({ content: _content, ...output }) => output);
  invariant(canonicalJson(descriptors) === canonicalJson(manifestOutputs),
    'TASK_CANDIDATE_OUTPUT_MISMATCH', 'Candidate output bytes do not form the exact manifest output closure.');
  return outputs;
}

export function validateTaskCandidatePayload(value) {
  const payload = exactFields(snapshotPlainData(value, 'candidate'), [
    'schemaVersion', 'kind', 'candidateManifest', 'candidateFingerprint',
    'outputs', 'outputClosureFingerprint', 'fingerprint',
  ], 'candidate');
  invariant(payload.schemaVersion === TASK_CANDIDATE_SCHEMA_VERSION && payload.kind === TASK_CANDIDATE_PAYLOAD_KIND,
    'TASK_CANDIDATE_SCHEMA_UNSUPPORTED', 'The task-candidate payload schema is unsupported.');
  const manifest = validateCandidateManifest(payload.candidateManifest);
  invariant(manifest.status === 'VERIFIED', 'TASK_CANDIDATE_NOT_VERIFIED', 'Task submission requires a verified candidate manifest.');
  const candidateFingerprint = requireHash(payload.candidateFingerprint, 'candidate.candidateFingerprint');
  invariant(candidateFingerprint === candidateManifestSha256(manifest),
    'TASK_CANDIDATE_FINGERPRINT_MISMATCH', 'Candidate manifest fingerprint does not match.');
  const outputs = normalizeOutputs(payload.outputs, manifest);
  const closure = outputClosureFingerprint(outputs);
  invariant(requireHash(payload.outputClosureFingerprint, 'candidate.outputClosureFingerprint') === closure
    && manifest.adapter.candidateHash === closure,
  'TASK_CANDIDATE_OUTPUT_MISMATCH', 'The adapter candidate hash does not bind the exact output closure.');
  const normalized = {
    schemaVersion: TASK_CANDIDATE_SCHEMA_VERSION,
    kind: TASK_CANDIDATE_PAYLOAD_KIND,
    candidateManifest: manifest,
    candidateFingerprint,
    outputs,
    outputClosureFingerprint: closure,
    fingerprint: requireHash(payload.fingerprint, 'candidate.fingerprint'),
  };
  invariant(normalized.fingerprint === fingerprintCore(normalized),
    'TASK_CANDIDATE_FINGERPRINT_MISMATCH', 'Task-candidate payload fingerprint does not match.');
  return deepFreeze(normalized);
}

export function createTaskCandidatePayload({ candidateManifest, outputs }) {
  const manifest = validateCandidateManifest(candidateManifest);
  const normalizedOutputs = normalizeOutputs(snapshotPlainData(outputs, 'outputs'), manifest);
  const value = {
    schemaVersion: TASK_CANDIDATE_SCHEMA_VERSION,
    kind: TASK_CANDIDATE_PAYLOAD_KIND,
    candidateManifest: manifest,
    candidateFingerprint: candidateManifestSha256(manifest),
    outputs: normalizedOutputs,
    outputClosureFingerprint: outputClosureFingerprint(normalizedOutputs),
  };
  value.fingerprint = fingerprintCore(value);
  return validateTaskCandidatePayload(value);
}

function normalizePreviewFacts(values) {
  invariant(Array.isArray(values) && values.length >= 1 && values.length <= 64,
    'TASK_CANDIDATE_LIMIT_EXCEEDED', 'preview.facts must contain between 1 and 64 entries.');
  const facts = values.map((raw, index) => {
    const fact = exactFields(raw, ['factId', 'label', 'value'], `preview.facts[${index}]`);
    return {
      factId: requireId(fact.factId, `preview.facts[${index}].factId`),
      label: requireString(fact.label, `preview.facts[${index}].label`, { max: 128 }),
      value: requireString(fact.value, `preview.facts[${index}].value`, { max: 4_096, controls: true }),
    };
  });
  invariant(new Set(facts.map(({ factId }) => factId)).size === facts.length,
    'TASK_CANDIDATE_INPUT_INVALID', 'preview facts must have unique IDs.');
  return facts;
}

function normalizePreviewSteps(values) {
  invariant(Array.isArray(values) && values.length >= 1 && values.length <= 64,
    'TASK_CANDIDATE_LIMIT_EXCEEDED', 'preview.steps must contain between 1 and 64 entries.');
  return values.map((raw, index) => {
    const step = exactFields(raw, ['sequence', 'triggerKind', 'triggerRef', 'actionKind', 'actionRef', 'targetRef'], `preview.steps[${index}]`);
    invariant(step.sequence === index + 1, 'TASK_CANDIDATE_INPUT_INVALID', 'Preview step sequence must be contiguous.');
    return {
      sequence: step.sequence,
      triggerKind: requireToken(step.triggerKind, `preview.steps[${index}].triggerKind`),
      triggerRef: requireId(step.triggerRef, `preview.steps[${index}].triggerRef`),
      actionKind: requireToken(step.actionKind, `preview.steps[${index}].actionKind`),
      actionRef: requireId(step.actionRef, `preview.steps[${index}].actionRef`),
      targetRef: requireId(step.targetRef, `preview.steps[${index}].targetRef`),
    };
  });
}

export function validateTaskCandidatePreview(value) {
  const preview = exactFields(snapshotPlainData(value, 'preview'), [
    'schemaVersion', 'kind', 'candidateFingerprint', 'title', 'summary', 'facts', 'steps', 'fingerprint',
  ], 'preview');
  invariant(preview.schemaVersion === TASK_CANDIDATE_SCHEMA_VERSION && preview.kind === TASK_CANDIDATE_PREVIEW_KIND,
    'TASK_CANDIDATE_SCHEMA_UNSUPPORTED', 'The task-candidate preview schema is unsupported.');
  const normalized = {
    schemaVersion: TASK_CANDIDATE_SCHEMA_VERSION,
    kind: TASK_CANDIDATE_PREVIEW_KIND,
    candidateFingerprint: requireHash(preview.candidateFingerprint, 'preview.candidateFingerprint'),
    title: requireString(preview.title, 'preview.title', { max: 256 }),
    summary: requireString(preview.summary, 'preview.summary', { max: 2_000 }),
    facts: normalizePreviewFacts(preview.facts),
    steps: normalizePreviewSteps(preview.steps),
    fingerprint: requireHash(preview.fingerprint, 'preview.fingerprint'),
  };
  invariant(normalized.fingerprint === fingerprintCore(normalized),
    'TASK_CANDIDATE_FINGERPRINT_MISMATCH', 'Task-candidate preview fingerprint does not match.');
  return deepFreeze(normalized);
}

export function createTaskCandidatePreview(value) {
  const input = snapshotPlainData(value, 'preview');
  const preview = {
    schemaVersion: TASK_CANDIDATE_SCHEMA_VERSION,
    kind: TASK_CANDIDATE_PREVIEW_KIND,
    candidateFingerprint: input.candidateFingerprint,
    title: input.title,
    summary: input.summary,
    facts: input.facts,
    steps: input.steps,
  };
  preview.fingerprint = fingerprintCore(preview);
  return validateTaskCandidatePreview(preview);
}

function normalizeDiffChanges(values) {
  invariant(Array.isArray(values) && values.length >= 1 && values.length <= MAX_ARRAY_ENTRIES,
    'TASK_CANDIDATE_LIMIT_EXCEEDED', 'diff.changes must contain at least one bounded semantic change.');
  const changes = values.map((raw, index) => {
    const change = exactFields(raw, ['changeId', 'operation', 'objectKind', 'objectRef', 'summary'], `diff.changes[${index}]`);
    invariant(['ADD', 'MODIFY', 'REMOVE'].includes(change.operation),
      'TASK_CANDIDATE_INPUT_INVALID', 'Diff operation is unsupported.');
    return {
      changeId: requireId(change.changeId, `diff.changes[${index}].changeId`),
      operation: change.operation,
      objectKind: requireToken(change.objectKind, `diff.changes[${index}].objectKind`),
      objectRef: requireId(change.objectRef, `diff.changes[${index}].objectRef`),
      summary: requireString(change.summary, `diff.changes[${index}].summary`, { max: 1_000 }),
    };
  });
  invariant(new Set(changes.map(({ changeId }) => changeId)).size === changes.length,
    'TASK_CANDIDATE_INPUT_INVALID', 'Diff changes must have unique IDs.');
  return changes.sort((left, right) => left.changeId.localeCompare(right.changeId));
}

function normalizeDiffOutputs(values) {
  invariant(Array.isArray(values) && values.length >= 1 && values.length <= MAX_OUTPUTS,
    'TASK_CANDIDATE_LIMIT_EXCEEDED', 'diff.outputs must contain a bounded output delta.');
  return values.map((raw, index) => {
    const output = exactFields(raw, ['logicalPath', 'operation', 'beforeSha256', 'afterSha256'], `diff.outputs[${index}]`);
    invariant(['ADD', 'MODIFY', 'REMOVE'].includes(output.operation),
      'TASK_CANDIDATE_INPUT_INVALID', 'Diff output operation is unsupported.');
    return {
      logicalPath: requireString(output.logicalPath, `diff.outputs[${index}].logicalPath`, { max: 1_024 }),
      operation: output.operation,
      beforeSha256: output.beforeSha256 === null ? null : requireHash(output.beforeSha256, `diff.outputs[${index}].beforeSha256`),
      afterSha256: output.afterSha256 === null ? null : requireHash(output.afterSha256, `diff.outputs[${index}].afterSha256`),
    };
  }).sort((left, right) => left.logicalPath.localeCompare(right.logicalPath));
}

export function validateTaskCandidateDiff(value) {
  const diff = exactFields(snapshotPlainData(value, 'diff'), [
    'schemaVersion', 'kind', 'projectId', 'taskId', 'branchId', 'baseRevision',
    'branchHeadRevision', 'candidateFingerprint', 'changes', 'outputs', 'fingerprint',
  ], 'diff');
  invariant(diff.schemaVersion === TASK_CANDIDATE_SCHEMA_VERSION && diff.kind === TASK_CANDIDATE_DIFF_KIND,
    'TASK_CANDIDATE_SCHEMA_UNSUPPORTED', 'The task-candidate diff schema is unsupported.');
  const normalized = {
    schemaVersion: TASK_CANDIDATE_SCHEMA_VERSION,
    kind: TASK_CANDIDATE_DIFF_KIND,
    projectId: requireId(diff.projectId, 'diff.projectId'),
    taskId: requireId(diff.taskId, 'diff.taskId'),
    branchId: requireId(diff.branchId, 'diff.branchId'),
    baseRevision: requireRevision(diff.baseRevision, 'diff.baseRevision'),
    branchHeadRevision: requireRevision(diff.branchHeadRevision, 'diff.branchHeadRevision'),
    candidateFingerprint: requireHash(diff.candidateFingerprint, 'diff.candidateFingerprint'),
    changes: normalizeDiffChanges(diff.changes),
    outputs: normalizeDiffOutputs(diff.outputs),
    fingerprint: requireHash(diff.fingerprint, 'diff.fingerprint'),
  };
  invariant(normalized.branchHeadRevision > normalized.baseRevision,
    'TASK_CANDIDATE_INPUT_INVALID', 'Task-candidate diff requires a non-empty branch.');
  invariant(normalized.fingerprint === fingerprintCore(normalized),
    'TASK_CANDIDATE_FINGERPRINT_MISMATCH', 'Task-candidate diff fingerprint does not match.');
  return deepFreeze(normalized);
}

export function createTaskCandidateDiff(value) {
  const input = snapshotPlainData(value, 'diff');
  const diff = {
    schemaVersion: TASK_CANDIDATE_SCHEMA_VERSION,
    kind: TASK_CANDIDATE_DIFF_KIND,
    projectId: input.projectId,
    taskId: input.taskId,
    branchId: input.branchId,
    baseRevision: input.baseRevision,
    branchHeadRevision: input.branchHeadRevision,
    candidateFingerprint: input.candidateFingerprint,
    changes: input.changes,
    outputs: input.outputs,
  };
  diff.fingerprint = fingerprintCore(diff);
  return validateTaskCandidateDiff(diff);
}

function normalizeCompilerPins(values) {
  invariant(Array.isArray(values) && values.length >= 1 && values.length <= 8,
    'TASK_CANDIDATE_INPUT_INVALID', 'submission.compilerPins must contain between 1 and 8 pins.');
  const pins = values.map((raw, index) => {
    const pin = exactFields(raw, ['id', 'version', 'evidenceHash'], `submission.compilerPins[${index}]`);
    return {
      id: requireId(pin.id, `submission.compilerPins[${index}].id`),
      version: requireVersion(pin.version, `submission.compilerPins[${index}].version`),
      evidenceHash: requireHash(pin.evidenceHash, `submission.compilerPins[${index}].evidenceHash`),
    };
  }).sort((left, right) => left.id.localeCompare(right.id));
  invariant(new Set(pins.map(({ id }) => id)).size === pins.length,
    'TASK_CANDIDATE_INPUT_INVALID', 'Compiler pin IDs must be unique.');
  return pins;
}

function normalizeBridgeReceipt(value, candidateFingerprint) {
  const receipt = exactFields(value, [
    'schemaVersion', 'kind', 'status', 'bridge', 'candidateFingerprint', 'evidenceHash',
  ], 'submission.engineBridgeReceipt');
  const bridge = exactFields(receipt.bridge, ['id', 'version'], 'submission.engineBridgeReceipt.bridge');
  invariant(receipt.schemaVersion === 1
    && receipt.kind === 'studio.engine-bridge.validation-receipt'
    && receipt.status === 'VALIDATED',
  'TASK_CANDIDATE_INPUT_INVALID', 'The EngineBridge receipt is not a validated v1 receipt.');
  invariant(receipt.candidateFingerprint === candidateFingerprint,
    'TASK_CANDIDATE_FINGERPRINT_MISMATCH', 'The EngineBridge receipt identifies another candidate.');
  return {
    schemaVersion: 1,
    kind: 'studio.engine-bridge.validation-receipt',
    status: 'VALIDATED',
    bridge: {
      id: requireString(bridge.id, 'submission.engineBridgeReceipt.bridge.id', { max: 128 }),
      version: requireVersion(bridge.version, 'submission.engineBridgeReceipt.bridge.version'),
    },
    candidateFingerprint,
    evidenceHash: requireHash(receipt.evidenceHash, 'submission.engineBridgeReceipt.evidenceHash'),
  };
}

function authorityBoundary(value) {
  const boundary = exactFields(value, [
    'reviewDecision', 'merge', 'materialize', 'commit', 'publish', 'release',
  ], 'submission.authority');
  for (const field of Object.keys(boundary)) {
    invariant(boundary[field] === 'NOT_AUTHORIZED', 'TASK_CANDIDATE_AUTHORITY_FORBIDDEN', `A task candidate cannot grant ${field} authority.`);
  }
  return {
    reviewDecision: 'NOT_AUTHORIZED',
    merge: 'NOT_AUTHORIZED',
    materialize: 'NOT_AUTHORIZED',
    commit: 'NOT_AUTHORIZED',
    publish: 'NOT_AUTHORIZED',
    release: 'NOT_AUTHORIZED',
  };
}

export function validateTaskCandidateSubmission(value) {
  const submission = exactFields(snapshotPlainData(value, 'submission'), [
    'schemaVersion', 'kind', 'submissionId', 'idempotencyKeyHash', 'projectId',
    'taskId', 'branchId', 'baseRevision', 'branchHeadRevision', 'projectionFingerprint',
    'candidate', 'preview', 'diff', 'compilerPins', 'engineBridgeReceipt',
    'status', 'authority', 'fingerprint',
  ], 'submission');
  invariant(submission.schemaVersion === TASK_CANDIDATE_SCHEMA_VERSION
    && submission.kind === TASK_CANDIDATE_SUBMISSION_KIND,
  'TASK_CANDIDATE_SCHEMA_UNSUPPORTED', 'The task-candidate submission schema is unsupported.');
  invariant(submission.status === 'WAITING_FOR_HUMAN_REVIEW',
    'TASK_CANDIDATE_INPUT_INVALID', 'A4c submission must stop at human review.');
  const candidate = validateTaskCandidatePayload(submission.candidate);
  const preview = validateTaskCandidatePreview(submission.preview);
  const diff = validateTaskCandidateDiff(submission.diff);
  const projectId = requireId(submission.projectId, 'submission.projectId');
  const taskId = requireId(submission.taskId, 'submission.taskId');
  const branchId = requireId(submission.branchId, 'submission.branchId');
  const baseRevision = requireRevision(submission.baseRevision, 'submission.baseRevision');
  const branchHeadRevision = requireRevision(submission.branchHeadRevision, 'submission.branchHeadRevision');
  invariant(candidate.candidateManifest.project.projectId === projectId
    && candidate.candidateManifest.project.revision === branchHeadRevision
    && preview.candidateFingerprint === candidate.candidateFingerprint
    && diff.projectId === projectId && diff.taskId === taskId && diff.branchId === branchId
    && diff.baseRevision === baseRevision && diff.branchHeadRevision === branchHeadRevision
    && diff.candidateFingerprint === candidate.candidateFingerprint,
  'TASK_CANDIDATE_BINDING_MISMATCH', 'Candidate, preview, diff, and task coordinates do not form one closure.');
  const normalized = {
    schemaVersion: TASK_CANDIDATE_SCHEMA_VERSION,
    kind: TASK_CANDIDATE_SUBMISSION_KIND,
    submissionId: requireId(submission.submissionId, 'submission.submissionId'),
    idempotencyKeyHash: requireHash(submission.idempotencyKeyHash, 'submission.idempotencyKeyHash'),
    projectId,
    taskId,
    branchId,
    baseRevision,
    branchHeadRevision,
    projectionFingerprint: requireHash(submission.projectionFingerprint, 'submission.projectionFingerprint'),
    candidate,
    preview,
    diff,
    compilerPins: normalizeCompilerPins(submission.compilerPins),
    engineBridgeReceipt: normalizeBridgeReceipt(submission.engineBridgeReceipt, candidate.candidateFingerprint),
    status: 'WAITING_FOR_HUMAN_REVIEW',
    authority: authorityBoundary(submission.authority),
    fingerprint: requireHash(submission.fingerprint, 'submission.fingerprint'),
  };
  invariant(normalized.fingerprint === fingerprintCore(normalized),
    'TASK_CANDIDATE_FINGERPRINT_MISMATCH', 'Task-candidate submission fingerprint does not match.');
  return deepFreeze(normalized);
}

export function createTaskCandidateSubmission(value) {
  const input = snapshotPlainData(value, 'submission');
  const submission = {
    schemaVersion: TASK_CANDIDATE_SCHEMA_VERSION,
    kind: TASK_CANDIDATE_SUBMISSION_KIND,
    submissionId: input.submissionId,
    idempotencyKeyHash: input.idempotencyKeyHash,
    projectId: input.projectId,
    taskId: input.taskId,
    branchId: input.branchId,
    baseRevision: input.baseRevision,
    branchHeadRevision: input.branchHeadRevision,
    projectionFingerprint: input.projectionFingerprint,
    candidate: input.candidate,
    preview: input.preview,
    diff: input.diff,
    compilerPins: input.compilerPins,
    engineBridgeReceipt: input.engineBridgeReceipt,
    status: 'WAITING_FOR_HUMAN_REVIEW',
    authority: {
      reviewDecision: 'NOT_AUTHORIZED',
      merge: 'NOT_AUTHORIZED',
      materialize: 'NOT_AUTHORIZED',
      commit: 'NOT_AUTHORIZED',
      publish: 'NOT_AUTHORIZED',
      release: 'NOT_AUTHORIZED',
    },
  };
  submission.fingerprint = fingerprintCore(submission);
  return validateTaskCandidateSubmission(submission);
}

export function taskCandidateSha256(value) {
  return validateTaskCandidateSubmission(value).fingerprint;
}
