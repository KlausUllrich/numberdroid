import { types as utilTypes } from 'node:util';
import {
  AUTHORING_V2_FEATURE_ID,
  AUTHORING_V2_SCHEMA_VERSION,
  projectCapabilityManifestSha256,
  validateAuthoringV2CapabilityManifest,
} from '../../domain/src/index.js';
import { StudioError, invariant } from '../../domain/src/errors.js';
import { requireId, requireInteger } from '../../domain/src/validation.js';
import { deepFreeze, fingerprint } from './value-utils.js';

export const AUTHORING_V2_ADMISSION_READER_SCHEMA_VERSION = 1;
export const AUTHORING_V2_ADMISSION_READER_KIND = 'studio.authoring-v2-admission-reader';
export const AUTHORING_V2_ADMISSION_EVIDENCE_KIND = 'studio.authoring-v2-admission-evidence';
export const AUTHORING_V2_CAPABILITY_READER_SCHEMA_VERSION = 1;
export const AUTHORING_V2_CAPABILITY_READER_KIND = 'studio.authoring-v2-capability-reader';

const ADMISSION_PORT = 'authoringV2AdmissionReader';
const CAPABILITY_PORT = 'authoringV2CapabilityReader';
const EXPECTED_ADMISSION_REJECTION_CODES = new Set([
  'AUTO_ACCEPT_FORBIDDEN',
  'BUDGET_EXCEEDED',
  'GRANT_ACTOR_MISMATCH',
  'GRANT_BRANCH_MISMATCH',
  'GRANT_EXPIRED',
  'GRANT_NOT_FOUND',
  'GRANT_REQUIRED',
  'GRANT_REVOKED',
  'GRANT_SCOPE_MISSING',
  'GRANT_TASK_MISMATCH',
  'HOST_BINDING_EXPIRED',
  'HOST_BINDING_GRANT_MISMATCH',
  'HOST_BINDING_NOT_FOUND',
  'HOST_BINDING_REVOKED',
  'OBJECT_SCOPE_DENIED',
  'REVISION_CONFLICT',
  'TASK_ACTOR_MISMATCH',
  'TASK_BRANCH_MISMATCH',
  'TASK_BRANCH_REQUIRED',
  'TASK_CAPABILITY_MISSING',
  'TASK_EXPIRED',
  'TASK_GRANT_MISMATCH',
  'TASK_NOT_EXECUTABLE',
  'TASK_NOT_FOUND',
  'TASK_PAUSED',
]);

function exactPlainRecord(value, allowed, label, code = 'AUTHORING_V2_ADMISSION_INVALID', { required = allowed } = {}) {
  invariant(
    value !== null
      && typeof value === 'object'
      && !Array.isArray(value)
      && !utilTypes.isProxy(value),
    code,
    `${label} must be an inspectable plain object.`,
    { port: label },
  );
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    invariant(false, code, `${label} must be inspectable.`, { port: label });
  }
  invariant(
    (prototype === Object.prototype || prototype === null)
      && keys.every((key) => typeof key === 'string' && allowed.includes(key)),
    code,
    `${label} contains fields outside its contract.`,
    { port: label },
  );
  const snapshot = Object.create(null);
  for (const field of allowed) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, field);
    } catch {
      invariant(false, code, `${label}.${field} must be inspectable.`, { port: label });
    }
    if (!descriptor) continue;
    invariant(
      Object.hasOwn(descriptor, 'value') && descriptor.enumerable === true,
      code,
      `${label}.${field} must be an enumerable own data field.`,
      { port: label },
    );
    snapshot[field] = descriptor.value;
  }
  invariant(
    required.every((field) => Object.hasOwn(snapshot, field)),
    code,
    `${label} is missing required fields.`,
    { port: label },
  );
  return snapshot;
}

function snapshotPlainData(value, label, state = { ancestors: new WeakSet(), nodes: 0 }, depth = 0) {
  state.nodes += 1;
  invariant(
    state.nodes <= 4096 && depth <= 32,
    'AUTHORING_V2_PORT_RESPONSE_INVALID',
    `${label} exceeds the bounded plain-data graph accepted by Authoring v2.`,
    { port: label },
  );
  if (value === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof value)) return value;
  invariant(
    typeof value === 'object' && !utilTypes.isProxy(value),
    'AUTHORING_V2_PORT_RESPONSE_INVALID',
    `${label} must be plain inspectable data.`,
    { port: label },
  );
  invariant(
    !state.ancestors.has(value),
    'AUTHORING_V2_PORT_RESPONSE_INVALID',
    `${label} must not contain cycles.`,
    { port: label },
  );
  state.ancestors.add(value);
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    invariant(false, 'AUTHORING_V2_PORT_RESPONSE_INVALID', `${label} must be inspectable.`, { port: label });
  }
  if (Array.isArray(value)) {
    invariant(prototype === Array.prototype, 'AUTHORING_V2_PORT_RESPONSE_INVALID', `${label} must be a plain array.`, { port: label });
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    const length = lengthDescriptor?.value;
    invariant(Number.isSafeInteger(length) && length >= 0 && length <= 512, 'AUTHORING_V2_PORT_RESPONSE_INVALID', `${label} must be bounded.`, { port: label });
    const allowed = new Set(['length', ...Array.from({ length }, (_, index) => String(index))]);
    invariant(keys.every((key) => typeof key === 'string' && allowed.has(key)), 'AUTHORING_V2_PORT_RESPONSE_INVALID', `${label} contains forbidden array fields.`, { port: label });
    const result = new Array(length);
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      invariant(descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable === true, 'AUTHORING_V2_PORT_RESPONSE_INVALID', `${label} must not contain sparse or accessor entries.`, { port: label });
      result[index] = snapshotPlainData(descriptor.value, `${label}[${index}]`, state, depth + 1);
    }
    state.ancestors.delete(value);
    return result;
  }
  invariant(prototype === Object.prototype || prototype === null, 'AUTHORING_V2_PORT_RESPONSE_INVALID', `${label} must be a plain object.`, { port: label });
  const result = Object.create(null);
  for (const key of keys) {
    invariant(typeof key === 'string', 'AUTHORING_V2_PORT_RESPONSE_INVALID', `${label} must not contain symbols.`, { port: label });
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    invariant(descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable === true, 'AUTHORING_V2_PORT_RESPONSE_INVALID', `${label}.${key} must be an enumerable own data field.`, { port: label });
    result[key] = snapshotPlainData(descriptor.value, `${label}.${key}`, state, depth + 1);
  }
  state.ancestors.delete(value);
  return result;
}

function exactPort(value, kind, operationName, label) {
  const port = exactPlainRecord(
    value,
    ['schemaVersion', 'kind', operationName],
    label,
    'AUTHORING_V2_PORT_INVALID',
  );
  invariant(
    port.schemaVersion === 1
      && port.kind === kind
      && typeof port[operationName] === 'function'
      && !utilTypes.isProxy(port[operationName]),
    'AUTHORING_V2_PORT_INVALID',
    `Unsupported ${label}.`,
    { port: label },
  );
  const implementation = port[operationName];
  return Object.freeze({
    schemaVersion: 1,
    kind,
    [operationName]: (...args) => implementation.call(value, ...args),
  });
}

export function validateAuthoringV2AdmissionReader(value) {
  return exactPort(value, AUTHORING_V2_ADMISSION_READER_KIND, 'readAuthoringV2Admission', ADMISSION_PORT);
}

export function validateAuthoringV2CapabilityReader(value) {
  return exactPort(value, AUTHORING_V2_CAPABILITY_READER_KIND, 'readProjectCapabilityManifest', CAPABILITY_PORT);
}

function validateAbortSignal(value) {
  if (value === undefined) return undefined;
  invariant(
    value !== null && typeof value === 'object' && !utilTypes.isProxy(value),
    'AUTHORING_V2_REQUEST_INVALID',
    'Authoring-v2 signal must be an AbortSignal.',
  );
  let prototype;
  let stringKeys;
  try {
    prototype = Object.getPrototypeOf(value);
    stringKeys = Object.getOwnPropertyNames(value);
  } catch {
    invariant(false, 'AUTHORING_V2_REQUEST_INVALID', 'Authoring-v2 signal must be inspectable.');
  }
  invariant(
    prototype === AbortSignal.prototype && stringKeys.length === 0,
    'AUTHORING_V2_REQUEST_INVALID',
    'Authoring-v2 signal must be an unmodified AbortSignal.',
  );
  return value;
}

function exactOptions(value) {
  const options = exactPlainRecord(
    value,
    ['signal'],
    'authoringV2AdmissionOptions',
    'AUTHORING_V2_REQUEST_INVALID',
    { required: [] },
  );
  return validateAbortSignal(options.signal);
}

function abort(signal) {
  if (signal !== undefined) AbortSignal.prototype.throwIfAborted.call(signal);
}

function safeNativePromise(value) {
  if (value === null || typeof value !== 'object' || utilTypes.isProxy(value)) return null;
  try {
    if (Object.getPrototypeOf(value) !== Promise.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (!keys.every((key) => {
      if (typeof key !== 'symbol') return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor !== undefined && Object.hasOwn(descriptor, 'value');
    })) return null;
    return value;
  } catch {
    return null;
  }
}

function expectedAdmissionRejectionCode(error) {
  if (error === null || typeof error !== 'object' || utilTypes.isProxy(error)) return null;
  try {
    if (Object.getPrototypeOf(error) !== StudioError.prototype) return null;
    const descriptor = Object.getOwnPropertyDescriptor(error, 'code');
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'string') return null;
    return EXPECTED_ADMISSION_REJECTION_CODES.has(descriptor.value) ? descriptor.value : null;
  } catch {
    return null;
  }
}

function portFailure(port, error) {
  const code = expectedAdmissionRejectionCode(error);
  return code === null
    ? new StudioError('AUTHORING_V2_PORT_FAILED', 'A private Authoring-v2 dependency failed.', { port })
    : new StudioError(code, 'The private Authoring-v2 admission was rejected.');
}

async function invokePort(port, operation, signal) {
  abort(signal);
  let pending;
  try {
    pending = operation();
  } catch (error) {
    abort(signal);
    throw portFailure(port, error);
  }
  const promise = safeNativePromise(pending);
  if (promise === null) {
    abort(signal);
    return Object.freeze({ value: pending });
  }
  try {
    const envelope = await new Promise((resolve, reject) => {
      Promise.prototype.then.call(promise, (value) => resolve(Object.freeze({ value })), reject);
    });
    abort(signal);
    return envelope;
  } catch (error) {
    abort(signal);
    throw portFailure(port, error);
  }
}

function exactSelection(value) {
  const selection = exactPlainRecord(value, [
    'schemaVersion', 'featureId', 'projectId', 'actorId', 'taskId', 'grantId',
    'branchId', 'expectedRevision', 'targetAssetId',
  ], 'authoringV2AdmissionSelection');
  invariant(
    selection.schemaVersion === AUTHORING_V2_SCHEMA_VERSION
      && selection.featureId === AUTHORING_V2_FEATURE_ID,
    'AUTHORING_V2_ADMISSION_INVALID',
    'The Authoring-v2 admission selection is not pinned to the supported feature.',
  );
  const branchId = requireId(selection.branchId, 'authoringV2AdmissionSelection.branchId');
  invariant(branchId !== 'branch.main', 'TASK_BRANCH_REQUIRED', 'Authoring v2 requires an isolated task branch.');
  return deepFreeze({
    schemaVersion: AUTHORING_V2_SCHEMA_VERSION,
    featureId: AUTHORING_V2_FEATURE_ID,
    projectId: requireId(selection.projectId, 'authoringV2AdmissionSelection.projectId'),
    actorId: requireId(selection.actorId, 'authoringV2AdmissionSelection.actorId'),
    taskId: requireId(selection.taskId, 'authoringV2AdmissionSelection.taskId'),
    grantId: requireId(selection.grantId, 'authoringV2AdmissionSelection.grantId'),
    branchId,
    expectedRevision: selection.expectedRevision === null
      ? null
      : requireInteger(selection.expectedRevision, 'authoringV2AdmissionSelection.expectedRevision', { min: 1 }),
    targetAssetId: selection.targetAssetId === null
      ? null
      : requireId(selection.targetAssetId, 'authoringV2AdmissionSelection.targetAssetId'),
  });
}

function normalizeAdmissionEvidence(value, selection) {
  const evidence = exactPlainRecord(
    snapshotPlainData(value, 'authoringV2AdmissionEvidence'),
    [
      'schemaVersion', 'kind', 'featureId', 'projectId', 'actorId', 'taskId',
      'grantId', 'branchId', 'branchRevision', 'targetAssetId',
      'taskMaxCommands', 'taskUsedCommands', 'grantMaxCommands', 'grantUsedCommands',
    ],
    'authoringV2AdmissionEvidence',
    'AUTHORING_V2_PORT_RESPONSE_INVALID',
  );
  invariant(
    evidence.schemaVersion === AUTHORING_V2_ADMISSION_READER_SCHEMA_VERSION
      && evidence.kind === AUTHORING_V2_ADMISSION_EVIDENCE_KIND
      && evidence.featureId === AUTHORING_V2_FEATURE_ID
      && evidence.projectId === selection.projectId
      && evidence.actorId === selection.actorId
      && evidence.taskId === selection.taskId
      && evidence.grantId === selection.grantId
      && evidence.branchId === selection.branchId
      && evidence.targetAssetId === selection.targetAssetId,
    'AUTHORING_V2_PORT_RESPONSE_INVALID',
    'Authoring-v2 admission evidence does not close its trusted selection.',
    { port: ADMISSION_PORT },
  );
  const branchRevision = requireInteger(evidence.branchRevision, 'authoringV2AdmissionEvidence.branchRevision', { min: 1 });
  invariant(
    selection.expectedRevision === null || branchRevision === selection.expectedRevision,
    'REVISION_CONFLICT',
    'The Authoring-v2 task branch changed before admission completed.',
    { expectedRevision: selection.expectedRevision, actualRevision: branchRevision },
  );
  const taskMaxCommands = requireInteger(evidence.taskMaxCommands, 'authoringV2AdmissionEvidence.taskMaxCommands', { min: 1 });
  const taskUsedCommands = requireInteger(evidence.taskUsedCommands, 'authoringV2AdmissionEvidence.taskUsedCommands', { min: 0, max: taskMaxCommands });
  const grantMaxCommands = requireInteger(evidence.grantMaxCommands, 'authoringV2AdmissionEvidence.grantMaxCommands', { min: 1 });
  const grantUsedCommands = requireInteger(evidence.grantUsedCommands, 'authoringV2AdmissionEvidence.grantUsedCommands', { min: 0, max: grantMaxCommands });
  invariant(
    taskUsedCommands < taskMaxCommands && grantUsedCommands < grantMaxCommands,
    'BUDGET_EXCEEDED',
    'The Authoring-v2 command budget is exhausted.',
  );
  return deepFreeze({
    schemaVersion: AUTHORING_V2_ADMISSION_READER_SCHEMA_VERSION,
    kind: AUTHORING_V2_ADMISSION_EVIDENCE_KIND,
    featureId: AUTHORING_V2_FEATURE_ID,
    projectId: selection.projectId,
    actorId: selection.actorId,
    taskId: selection.taskId,
    grantId: selection.grantId,
    branchId: selection.branchId,
    branchRevision,
    targetAssetId: selection.targetAssetId,
    taskMaxCommands,
    taskUsedCommands,
    grantMaxCommands,
    grantUsedCommands,
  });
}

function normalizeCapabilityManifest(value, expectedManifest) {
  let snapshot;
  try {
    snapshot = snapshotPlainData(value, 'authoringV2CapabilityManifest');
  } catch {
    throw new StudioError(
      'AUTHORING_V2_CAPABILITY_INVALID',
      'The Authoring-v2 capability reader returned an invalid profile.',
    );
  }
  let manifest;
  try {
    manifest = validateAuthoringV2CapabilityManifest(snapshot);
  } catch {
    throw new StudioError(
      'AUTHORING_V2_CAPABILITY_INVALID',
      'The Authoring-v2 capability reader returned an invalid profile.',
    );
  }
  invariant(
    projectCapabilityManifestSha256(manifest) === projectCapabilityManifestSha256(expectedManifest),
    'AUTHORING_V2_CAPABILITY_MISMATCH',
    'The project capability profile is not the pinned Authoring-v2 profile.',
  );
  return manifest;
}

/**
 * Private, nonauthorizing A1.6b2a readiness seam. It closes current durable
 * admission before and after the asynchronous capability read. Its evidence
 * never leaves the private execution session and cannot authorize a commit.
 */
export class AuthoringV2AdmissionService {
  #admissionReader;

  #capabilityReader;

  #expectedManifest;

  constructor(options = {}) {
    const config = exactPlainRecord(
      options,
      ['admissionReader', 'capabilityReader', 'expectedCapabilityManifest'],
      'authoringV2AdmissionServiceOptions',
      'AUTHORING_V2_PORT_INVALID',
    );
    this.#admissionReader = validateAuthoringV2AdmissionReader(config.admissionReader);
    this.#capabilityReader = validateAuthoringV2CapabilityReader(config.capabilityReader);
    try {
      this.#expectedManifest = validateAuthoringV2CapabilityManifest(
        snapshotPlainData(config.expectedCapabilityManifest, 'expectedCapabilityManifest'),
      );
    } catch {
      throw new StudioError('AUTHORING_V2_PORT_INVALID', 'A pinned Authoring-v2 capability manifest is required.');
    }
  }

  admit(selectionValue, options = {}) {
    const signal = exactOptions(options);
    const selection = exactSelection(selectionValue);
    return this.#admit(selection, signal);
  }

  async #admit(selection, signal) {
    const { value: beforeValue } = await invokePort(
      ADMISSION_PORT,
      () => this.#admissionReader.readAuthoringV2Admission(selection, Object.freeze({ signal })),
      signal,
    );
    const before = normalizeAdmissionEvidence(beforeValue, selection);
    const { value: capabilityValue } = await invokePort(
      CAPABILITY_PORT,
      () => this.#capabilityReader.readProjectCapabilityManifest(deepFreeze({
        schemaVersion: 1,
        projectId: selection.projectId,
        revision: before.branchRevision,
      }), Object.freeze({ signal })),
      signal,
    );
    const manifest = normalizeCapabilityManifest(capabilityValue, this.#expectedManifest);
    const { value: afterValue } = await invokePort(
      ADMISSION_PORT,
      () => this.#admissionReader.readAuthoringV2Admission(selection, Object.freeze({ signal })),
      signal,
    );
    const after = normalizeAdmissionEvidence(afterValue, selection);
    invariant(
      fingerprint(before) === fingerprint(after),
      'AUTHORING_V2_ADMISSION_DRIFT',
      'Authoring-v2 authority changed while capability readiness was checked.',
    );
    abort(signal);
    return deepFreeze({
      evidence: after,
      capabilityManifest: manifest,
      capabilityFingerprint: projectCapabilityManifestSha256(manifest),
    });
  }
}
