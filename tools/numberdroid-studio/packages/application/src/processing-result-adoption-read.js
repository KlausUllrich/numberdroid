import { types as utilTypes } from 'node:util';
import { Readable } from 'node:stream';
import {
  validateProcessingResultAdoptionAggregate,
} from '../../domain/src/processing-result-adoption-commit.js';
import { StudioError, invariant } from '../../domain/src/errors.js';
import { requireId, requireInteger } from '../../domain/src/validation.js';
import { deepFreeze } from './value-utils.js';

export const PROCESSING_RESULT_ADOPTION_READER_SCHEMA_VERSION = 1;
export const PROCESSING_RESULT_ADOPTION_READER_KIND = 'studio.processing-result-adoption-reader';
export const PROCESSING_RESULT_ADOPTION_READ_FACTS_KIND = 'studio.processing-result-adoption-read-facts';

const PORT_NAME = 'processingResultAdoptionReader';
const PREVIEW_STATES = new Set(['READY', 'UNAVAILABLE']);
const ABORT_SIGNAL_ABORTED_GETTER = Object.getOwnPropertyDescriptor(
  AbortSignal.prototype,
  'aborted',
).get;
const DOM_EXCEPTION_NAME_GETTER = Object.getOwnPropertyDescriptor(
  DOMException.prototype,
  'name',
).get;
const DOM_EXCEPTION_STACK_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  new DOMException('', 'AbortError'),
  'stack',
);
const FINDING_LABELS = new Map([
  ['studio.asset.role.required', 'Asset role'],
  ['studio.asset.span.required', 'Tile footprint'],
  ['studio.asset.placement.confirmation_required', 'Placement confirmation'],
  ['studio.asset.wall_safety.required', 'Wall placement safety'],
  ['studio.asset.collision.required', 'Collision behavior'],
  ['studio.asset.navigation.required', 'Navigation effect'],
  ['studio.asset.runtime_eligibility.required', 'Runtime eligibility'],
  ['studio.asset.visual_weight.required', 'Visual weight'],
]);

function exactPlainRecord(value, fields, label, code) {
  invariant(
    value !== null
      && typeof value === 'object'
      && !Array.isArray(value)
      && !utilTypes.isProxy(value),
    code,
    `${label} must be an inspectable plain object.`,
    { port: PORT_NAME },
  );
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    invariant(false, code, `${label} must be inspectable.`, { port: PORT_NAME });
  }
  invariant(
    prototype === Object.prototype || prototype === null,
    code,
    `${label} must be a plain object.`,
    { port: PORT_NAME },
  );
  invariant(
    keys.length === fields.length
      && keys.every((key) => typeof key === 'string' && fields.includes(key)),
    code,
    `${label} must contain exactly its v1 fields.`,
    { port: PORT_NAME },
  );
  const result = Object.create(null);
  for (const field of fields) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, field);
    } catch {
      invariant(false, code, `${label}.${field} must be inspectable.`, { port: PORT_NAME });
    }
    invariant(
      descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable === true,
      code,
      `${label}.${field} must be an enumerable own data field.`,
      { port: PORT_NAME },
    );
    result[field] = descriptor.value;
  }
  return result;
}

function abort(signal) {
  if (signal !== undefined) AbortSignal.prototype.throwIfAborted.call(signal);
}

function validateAbortSignal(value) {
  if (value === undefined) return undefined;
  invariant(
    value !== null && typeof value === 'object' && !utilTypes.isProxy(value),
    'PROCESSING_RESULT_ADOPTION_READ_PORT_INVALID',
    'The processing-result adoption read signal must be an AbortSignal.',
    { port: PORT_NAME },
  );
  let prototype;
  let stringKeys;
  try {
    prototype = Object.getPrototypeOf(value);
    stringKeys = Object.getOwnPropertyNames(value);
  } catch {
    invariant(
      false,
      'PROCESSING_RESULT_ADOPTION_READ_PORT_INVALID',
      'The processing-result adoption read signal must be inspectable.',
      { port: PORT_NAME },
    );
  }
  invariant(
    prototype === AbortSignal.prototype && stringKeys.length === 0,
    'PROCESSING_RESULT_ADOPTION_READ_PORT_INVALID',
    'The processing-result adoption read signal must be an unmodified AbortSignal.',
    { port: PORT_NAME },
  );
  try {
    ABORT_SIGNAL_ABORTED_GETTER.call(value);
  } catch {
    invariant(
      false,
      'PROCESSING_RESULT_ADOPTION_READ_PORT_INVALID',
      'The processing-result adoption read signal must be a native AbortSignal.',
      { port: PORT_NAME },
    );
  }
  return value;
}

function exactOptions(options) {
  const hasSignal = options !== null
    && typeof options === 'object'
    && !utilTypes.isProxy(options)
    && Object.hasOwn(options, 'signal');
  const value = exactPlainRecord(
    options,
    hasSignal ? ['signal'] : [],
    'processingResultAdoptionReadOptions',
    'PROCESSING_RESULT_ADOPTION_READ_PORT_INVALID',
  );
  return validateAbortSignal(value.signal);
}

function selection(value, { includeRevision = false } = {}) {
  const fields = includeRevision
    ? ['schemaVersion', 'projectId', 'taskId', 'branchRevision']
    : ['schemaVersion', 'projectId', 'taskId'];
  const candidate = exactPlainRecord(
    value,
    fields,
    'processingResultAdoptionReadSelection',
    'PROCESSING_RESULT_ADOPTION_READ_REQUEST_INVALID',
  );
  invariant(
    candidate.schemaVersion === 1,
    'PROCESSING_RESULT_ADOPTION_READ_REQUEST_INVALID',
    'Processing-result adoption reads require schemaVersion 1.',
  );
  return Object.freeze({
    schemaVersion: 1,
    projectId: requireId(candidate.projectId, 'projectId'),
    taskId: requireId(candidate.taskId, 'taskId'),
    ...(includeRevision ? {
      branchRevision: requireInteger(candidate.branchRevision, 'branchRevision', { min: 2 }),
    } : {}),
  });
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

function expectedPortErrorCode(error) {
  if (error === null || typeof error !== 'object' || utilTypes.isProxy(error)) return null;
  try {
    if (Object.getPrototypeOf(error) !== StudioError.prototype) return null;
    const descriptor = Object.getOwnPropertyDescriptor(error, 'code');
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
    return [
      'TASK_NOT_FOUND',
      'PROCESSING_RESULT_ADOPTION_NOT_FOUND',
      'PROCESSING_RESULT_ADOPTION_PREVIEW_UNAVAILABLE',
    ].includes(descriptor.value) ? descriptor.value : null;
  } catch {
    return null;
  }
}

function isNativeAbortError(error) {
  if (error === null || typeof error !== 'object' || utilTypes.isProxy(error)) return false;
  try {
    if (Object.getPrototypeOf(error) !== DOMException.prototype) return false;
    const keys = Reflect.ownKeys(error);
    if (!keys.every((key) => {
      if (key !== 'stack') return false;
      const descriptor = Object.getOwnPropertyDescriptor(error, key);
      return descriptor !== undefined
        && descriptor.get === DOM_EXCEPTION_STACK_DESCRIPTOR.get
        && descriptor.set === DOM_EXCEPTION_STACK_DESCRIPTOR.set;
    })) return false;
    return DOM_EXCEPTION_NAME_GETTER.call(error) === 'AbortError';
  } catch {
    return false;
  }
}

function readerEnvelope(state, field, value) {
  const envelope = Object.create(null);
  Object.defineProperties(envelope, {
    state: { value: state, enumerable: true },
    [field]: { value, enumerable: true },
  });
  return Object.freeze(envelope);
}

function safePortFailure(error, fallbackCode) {
  if (isNativeAbortError(error)) throw error;
  const code = expectedPortErrorCode(error);
  if (code === 'TASK_NOT_FOUND') {
    throw new StudioError(code, 'The agent task does not exist.');
  }
  if (code === 'PROCESSING_RESULT_ADOPTION_NOT_FOUND') {
    throw new StudioError(code, 'The selected processing-result adoption does not exist.');
  }
  if (code === 'PROCESSING_RESULT_ADOPTION_PREVIEW_UNAVAILABLE') {
    throw new StudioError(code, 'The exact processed image preview is unavailable.');
  }
  throw new StudioError(
    fallbackCode,
    fallbackCode === 'PROCESSING_RESULT_ADOPTION_PREVIEW_UNAVAILABLE'
      ? 'The exact processed image preview is unavailable.'
      : 'Processed asset details are unavailable for this task.',
  );
}

async function invokeReader(operation, signal, fallbackCode) {
  abort(signal);
  let pending;
  try {
    pending = operation();
  } catch (error) {
    abort(signal);
    safePortFailure(error, fallbackCode);
  }
  const nativePromise = safeNativePromise(pending);
  if (!nativePromise) {
    safePortFailure(null, fallbackCode);
  }
  let settled;
  try {
    settled = await Promise.prototype.then.call(
      nativePromise,
      (value) => readerEnvelope('fulfilled', 'value', value),
      (error) => readerEnvelope('rejected', 'error', error),
    );
  } catch (error) {
    abort(signal);
    safePortFailure(error, fallbackCode);
  }
  abort(signal);
  if (settled.state === 'rejected') safePortFailure(settled.error, fallbackCode);
  return settled;
}

export function validateProcessingResultAdoptionReader(value) {
  const reader = exactPlainRecord(
    value,
    ['schemaVersion', 'kind', 'readTaskAdoptions', 'withSelectedOutput'],
    PORT_NAME,
    'PROCESSING_RESULT_ADOPTION_READ_PORT_INVALID',
  );
  invariant(
    reader.schemaVersion === PROCESSING_RESULT_ADOPTION_READER_SCHEMA_VERSION
      && reader.kind === PROCESSING_RESULT_ADOPTION_READER_KIND
      && typeof reader.readTaskAdoptions === 'function'
      && typeof reader.withSelectedOutput === 'function',
    'PROCESSING_RESULT_ADOPTION_READ_PORT_INVALID',
    'The processing-result adoption reader does not implement the exact v1 port.',
    { port: PORT_NAME },
  );
  invariant(
    !utilTypes.isProxy(reader.readTaskAdoptions)
      && !utilTypes.isProxy(reader.withSelectedOutput),
    'PROCESSING_RESULT_ADOPTION_READ_PORT_INVALID',
    'The processing-result adoption reader methods must be inspectable functions.',
    { port: PORT_NAME },
  );
  return Object.freeze({
    schemaVersion: PROCESSING_RESULT_ADOPTION_READER_SCHEMA_VERSION,
    kind: PROCESSING_RESULT_ADOPTION_READER_KIND,
    readTaskAdoptions: reader.readTaskAdoptions,
    withSelectedOutput: reader.withSelectedOutput,
  });
}

function exactDenseArray(value, { maxItems, label, code }) {
  invariant(
    Array.isArray(value) && !utilTypes.isProxy(value),
    code,
    `${label} must be an inspectable array.`,
    { port: PORT_NAME },
  );
  let prototype;
  let keys;
  let lengthDescriptor;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
    lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  } catch {
    invariant(false, code, `${label} must be inspectable.`, { port: PORT_NAME });
  }
  invariant(
    prototype === Array.prototype
      && lengthDescriptor
      && Object.hasOwn(lengthDescriptor, 'value')
      && Number.isSafeInteger(lengthDescriptor.value)
      && lengthDescriptor.value >= 0
      && lengthDescriptor.value <= maxItems,
    code,
    `${label} must be a bounded native array.`,
    { port: PORT_NAME },
  );
  const expectedKeys = [
    ...Array.from({ length: lengthDescriptor.value }, (_, index) => String(index)),
    'length',
  ];
  invariant(
    keys.length === expectedKeys.length
      && keys.every((key, index) => key === expectedKeys[index]),
    code,
    `${label} must be dense and contain no extra fields.`,
    { port: PORT_NAME },
  );
  return expectedKeys.slice(0, -1).map((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    invariant(
      descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable === true,
      code,
      `${label}[${key}] must be an enumerable own data field.`,
      { port: PORT_NAME },
    );
    return descriptor.value;
  });
}

function validatedFacts(value, expected) {
  const facts = exactPlainRecord(
    value,
    ['schemaVersion', 'kind', 'projectId', 'taskId', 'adoptions'],
    'processingResultAdoptionReadFacts',
    'PROCESSING_RESULT_ADOPTION_READ_RESPONSE_INVALID',
  );
  invariant(
    facts.schemaVersion === 1
      && facts.kind === PROCESSING_RESULT_ADOPTION_READ_FACTS_KIND
      && facts.projectId === expected.projectId
      && facts.taskId === expected.taskId,
    'PROCESSING_RESULT_ADOPTION_READ_RESPONSE_INVALID',
    'The processing-result adoption reader returned mismatched task facts.',
    { port: PORT_NAME },
  );
  const factAdoptions = exactDenseArray(facts.adoptions, {
    maxItems: 4096,
    label: 'processingResultAdoptionReadFacts.adoptions',
    code: 'PROCESSING_RESULT_ADOPTION_READ_RESPONSE_INVALID',
  });
  let previousRevision = 1;
  const adoptions = factAdoptions.map((value_, index) => {
    const record = exactPlainRecord(
      value_,
      ['aggregate', 'previewState'],
      `processingResultAdoptionReadFacts.adoptions[${index}]`,
      'PROCESSING_RESULT_ADOPTION_READ_RESPONSE_INVALID',
    );
    let aggregate;
    try {
      aggregate = validateProcessingResultAdoptionAggregate(record.aggregate);
    } catch {
      throw new StudioError(
        'PROCESSING_RESULT_ADOPTION_READ_RESPONSE_INVALID',
        'The processing-result adoption reader returned an invalid immutable record.',
        { port: PORT_NAME },
      );
    }
    invariant(
      aggregate.project.projectId === expected.projectId
        && aggregate.project.taskId === expected.taskId
        && aggregate.project.branchRevision > previousRevision
        && PREVIEW_STATES.has(record.previewState),
      'PROCESSING_RESULT_ADOPTION_READ_RESPONSE_INVALID',
      'The processing-result adoption reader returned unordered or mismatched facts.',
      { port: PORT_NAME },
    );
    previousRevision = aggregate.project.branchRevision;
    return { aggregate, previewState: record.previewState };
  });
  return adoptions;
}

function correctionItem(finding) {
  return {
    label: FINDING_LABELS.get(finding.ruleId) ?? 'Asset detail needs attention',
    explanation: finding.explanation,
    remediation: finding.remediation,
  };
}

function publicAdoption(projectId, taskId, { aggregate, previewState }) {
  const { asset } = aggregate;
  const pixelSize = asset.processingBinding.pixelSize;
  return {
    branchRevision: aggregate.project.branchRevision,
    committedAt: aggregate.committedAt,
    operation: aggregate.operation,
    displayState: 'WAITING_FOR_YOUR_REVIEW',
    asset: {
      assetId: asset.assetId,
      name: asset.name,
      kind: asset.kind,
      lifecycle: 'DRAFT',
      assetVersion: asset.assetVersion,
      metadataVersion: asset.metadataVersion,
      pixelSize: { width: pixelSize.width, height: pixelSize.height },
      preview: {
        state: previewState,
        resourceUri: previewState === 'READY'
          ? `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/processing-result-adoptions/${aggregate.project.branchRevision}/selected-output`
          : null,
        mediaType: 'image/png',
        width: pixelSize.width,
        height: pixelSize.height,
        alt: `${asset.name} processed asset preview`,
      },
    },
    quality: {
      correctionRequired: asset.findings.some(({ severity }) => severity === 'ERROR'),
      correctionItems: asset.findings
        .filter(({ severity }) => severity === 'ERROR')
        .map(correctionItem),
      unresolvedWarnings: aggregate.unresolvedProcessingWarnings.map((warning) => ({
        explanation: warning.explanation,
        remediation: warning.remediation,
      })),
    },
  };
}

function validateReadable(value) {
  const descriptor = exactPlainRecord(
    value,
    ['schemaVersion', 'mediaType', 'byteSize', 'width', 'height', 'readable'],
    'processingResultAdoptionSelectedOutput',
    'PROCESSING_RESULT_ADOPTION_READ_RESPONSE_INVALID',
  );
  invariant(
    descriptor.schemaVersion === 1
      && descriptor.mediaType === 'image/png'
      && Number.isSafeInteger(descriptor.byteSize) && descriptor.byteSize > 0
      && Number.isSafeInteger(descriptor.width) && descriptor.width > 0
      && Number.isSafeInteger(descriptor.height) && descriptor.height > 0
      && descriptor.readable !== null
      && typeof descriptor.readable === 'object'
      && !utilTypes.isProxy(descriptor.readable)
      && Object.getPrototypeOf(descriptor.readable) === Readable.prototype,
    'PROCESSING_RESULT_ADOPTION_READ_RESPONSE_INVALID',
    'The processing-result adoption reader returned an invalid selected-output stream.',
    { port: PORT_NAME },
  );
  return descriptor;
}

export class ProcessingResultAdoptionReadService {
  #reader;

  constructor(options = {}) {
    const config = exactPlainRecord(
      options,
      ['reader'],
      'processingResultAdoptionReadServiceOptions',
      'PROCESSING_RESULT_ADOPTION_READ_PORT_INVALID',
    );
    this.#reader = validateProcessingResultAdoptionReader(config.reader);
  }

  async readTaskAdoptions(selectionValue, options = {}) {
    const request = selection(selectionValue);
    const signal = exactOptions(options);
    abort(signal);
    const factsEnvelope = await invokeReader(
      () => this.#reader.readTaskAdoptions(request, Object.freeze({ signal })),
      signal,
      'PROCESSING_RESULT_ADOPTION_READ_UNAVAILABLE',
    );
    const facts = factsEnvelope.value;
    let adoptions;
    try {
      adoptions = validatedFacts(facts, request)
        .map((record) => publicAdoption(request.projectId, request.taskId, record));
    } catch (error) {
      safePortFailure(error, 'PROCESSING_RESULT_ADOPTION_READ_UNAVAILABLE');
    }
    return deepFreeze({
      schemaVersion: 1,
      projectId: request.projectId,
      taskId: request.taskId,
      availability: 'AVAILABLE',
      adoptions,
    });
  }

  async withSelectedOutput(selectionValue, operation, options = {}) {
    const request = selection(selectionValue, { includeRevision: true });
    invariant(
      typeof operation === 'function',
      'PROCESSING_RESULT_ADOPTION_READ_REQUEST_INVALID',
      'Selected-output reads require an operation callback.',
    );
    const signal = exactOptions(options);
    abort(signal);
    const completionMarker = Object.freeze(Object.create(null));
    let callbackCalls = 0;
    let callbackState = 'PENDING';
    let operationResult = null;
    try {
      const readerResult = await invokeReader(
        () => this.#reader.withSelectedOutput(
          request,
          async (value) => {
            callbackCalls += 1;
            invariant(
              callbackCalls === 1 && callbackState === 'PENDING',
              'PROCESSING_RESULT_ADOPTION_READ_RESPONSE_INVALID',
              'The processing-result adoption reader invoked the selected-output callback more than once.',
              { port: PORT_NAME },
            );
            callbackState = 'RUNNING';
            abort(signal);
            const descriptor = validateReadable(value);
            const result = await operation(descriptor);
            operationResult = readerEnvelope('fulfilled', 'value', result);
            callbackState = 'COMPLETED';
            return completionMarker;
          },
          Object.freeze({ signal }),
        ),
        signal,
        'PROCESSING_RESULT_ADOPTION_PREVIEW_UNAVAILABLE',
      );
      invariant(
        callbackCalls === 1
          && callbackState === 'COMPLETED'
          && readerResult.value === completionMarker
          && operationResult?.state === 'fulfilled',
        'PROCESSING_RESULT_ADOPTION_READ_RESPONSE_INVALID',
        'The processing-result adoption reader did not complete the selected-output callback.',
        { port: PORT_NAME },
      );
      return operationResult.value;
    } catch (error) {
      abort(signal);
      safePortFailure(error, 'PROCESSING_RESULT_ADOPTION_PREVIEW_UNAVAILABLE');
    }
  }
}
