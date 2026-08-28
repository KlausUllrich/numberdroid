import { types as utilTypes } from 'node:util';
import {
  PROCESSING_ADOPTION_PREFLIGHT_ARTIFACT_ROLES,
  createProcessingAdoptionPreflightReceipt,
  evaluateProcessingAdoptionArtifact,
  evaluateProcessingAdoptionAssetState,
  evaluateProcessingAdoptionCapability,
  uncheckedProcessingAdoptionArtifacts,
  uncheckedProcessingAdoptionAssetState,
  uncheckedProcessingAdoptionCapability,
  validateProcessingAdoptionPreflightRequest,
} from '../../domain/src/processing-adoption-preflight.js';
import { StudioError, invariant } from '../../domain/src/errors.js';
import { projectCapabilitySelection } from './project-capability-provider.js';
import { deepFreeze } from './value-utils.js';

export const PROCESSING_ADOPTION_ASSET_STATE_READER_SCHEMA_VERSION = 1;
export const PROCESSING_ADOPTION_ASSET_STATE_READER_KIND = 'studio.processing-adoption.asset-state-reader';
export const PROCESSING_ADOPTION_ARTIFACT_VERIFIER_SCHEMA_VERSION = 1;
export const PROCESSING_ADOPTION_ARTIFACT_VERIFIER_KIND = 'studio.processing-adoption.artifact-verifier';

function validateTrustedCapabilityProvider(value) {
  invariant(
    value !== null
      && typeof value === 'object'
      && !utilTypes.isProxy(value),
    'PROCESSING_ADOPTION_PREFLIGHT_PORT_INVALID',
    'The trusted capability provider must be an inspectable object.',
    { port: 'capabilityProvider' },
  );
  let current = value;
  let descriptor;
  try {
    while (current !== null && descriptor === undefined) {
      descriptor = Object.getOwnPropertyDescriptor(current, 'getProjectCapabilityManifest');
      current = Object.getPrototypeOf(current);
    }
  } catch {
    invariant(false, 'PROCESSING_ADOPTION_PREFLIGHT_PORT_INVALID', 'The trusted capability provider must be inspectable.', { port: 'capabilityProvider' });
  }
  invariant(
    descriptor && Object.hasOwn(descriptor, 'value') && typeof descriptor.value === 'function',
    'PROCESSING_ADOPTION_PREFLIGHT_PORT_INVALID',
    'The trusted capability provider must expose a data-method getProjectCapabilityManifest(selection, context).',
    { port: 'capabilityProvider' },
  );
  const implementation = descriptor.value;
  return Object.freeze({
    getProjectCapabilityManifest: (selection, context) => implementation.call(value, selection, context),
  });
}

function exactPort(value, allowed, label) {
  invariant(
    value !== null
      && typeof value === 'object'
      && !Array.isArray(value)
      && !utilTypes.isProxy(value),
    'PROCESSING_ADOPTION_PREFLIGHT_PORT_INVALID',
    `${label} must be an inspectable plain object.`,
    { port: label },
  );
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    invariant(false, 'PROCESSING_ADOPTION_PREFLIGHT_PORT_INVALID', `${label} must be inspectable.`, { port: label });
  }
  invariant(
    prototype === Object.prototype || prototype === null,
    'PROCESSING_ADOPTION_PREFLIGHT_PORT_INVALID',
    `${label} must be a plain object.`,
    { port: label },
  );
  invariant(
    keys.length === allowed.length
      && keys.every((key) => typeof key === 'string' && allowed.includes(key)),
    'PROCESSING_ADOPTION_PREFLIGHT_PORT_INVALID',
    `${label} exposes fields outside its read-only v1 contract.`,
    { port: label },
  );
  const snapshot = Object.create(null);
  for (const field of allowed) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, field);
    } catch {
      invariant(false, 'PROCESSING_ADOPTION_PREFLIGHT_PORT_INVALID', `${label}.${field} must be inspectable.`, { port: label });
    }
    invariant(
      descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable === true,
      'PROCESSING_ADOPTION_PREFLIGHT_PORT_INVALID',
      `${label}.${field} must be an enumerable own data field.`,
      { port: label },
    );
    snapshot[field] = descriptor.value;
  }
  return snapshot;
}

export function validateProcessingAdoptionAssetStateReader(value) {
  const port = exactPort(value, [
    'schemaVersion', 'kind', 'readAssetState',
  ], 'assetStateReader');
  invariant(
    port.schemaVersion === PROCESSING_ADOPTION_ASSET_STATE_READER_SCHEMA_VERSION,
    'PROCESSING_ADOPTION_PREFLIGHT_PORT_INVALID',
    'Unsupported processing adoption asset-state reader schema.',
    { port: 'assetStateReader' },
  );
  invariant(
    port.kind === PROCESSING_ADOPTION_ASSET_STATE_READER_KIND,
    'PROCESSING_ADOPTION_PREFLIGHT_PORT_INVALID',
    'Processing adoption asset-state reader kind is invalid.',
    { port: 'assetStateReader' },
  );
  invariant(
    typeof port.readAssetState === 'function',
    'PROCESSING_ADOPTION_PREFLIGHT_PORT_INVALID',
    'The asset-state reader must expose readAssetState(selection, context).',
    { port: 'assetStateReader' },
  );
  const implementation = port.readAssetState;
  return Object.freeze({
    schemaVersion: PROCESSING_ADOPTION_ASSET_STATE_READER_SCHEMA_VERSION,
    kind: PROCESSING_ADOPTION_ASSET_STATE_READER_KIND,
    readAssetState: (selection, context) => implementation.call(value, selection, context),
  });
}

export function validateProcessingAdoptionArtifactVerifier(value) {
  const port = exactPort(value, [
    'schemaVersion', 'kind', 'verifyProjectArtifact',
  ], 'artifactVerifier');
  invariant(
    port.schemaVersion === PROCESSING_ADOPTION_ARTIFACT_VERIFIER_SCHEMA_VERSION,
    'PROCESSING_ADOPTION_PREFLIGHT_PORT_INVALID',
    'Unsupported processing adoption artifact verifier schema.',
    { port: 'artifactVerifier' },
  );
  invariant(
    port.kind === PROCESSING_ADOPTION_ARTIFACT_VERIFIER_KIND,
    'PROCESSING_ADOPTION_PREFLIGHT_PORT_INVALID',
    'Processing adoption artifact verifier kind is invalid.',
    { port: 'artifactVerifier' },
  );
  invariant(
    typeof port.verifyProjectArtifact === 'function',
    'PROCESSING_ADOPTION_PREFLIGHT_PORT_INVALID',
    'The artifact verifier must expose verifyProjectArtifact(selection, context).',
    { port: 'artifactVerifier' },
  );
  const implementation = port.verifyProjectArtifact;
  return Object.freeze({
    schemaVersion: PROCESSING_ADOPTION_ARTIFACT_VERIFIER_SCHEMA_VERSION,
    kind: PROCESSING_ADOPTION_ARTIFACT_VERIFIER_KIND,
    verifyProjectArtifact: (selection, context) => implementation.call(value, selection, context),
  });
}

function abort(signal) {
  signal?.throwIfAborted();
}

async function invokeReadPort(port, operation, signal) {
  abort(signal);
  try {
    const result = await operation();
    abort(signal);
    return result;
  } catch {
    abort(signal);
    throw new StudioError(
      'PROCESSING_ADOPTION_PREFLIGHT_PORT_FAILED',
      'A read-only processing adoption preflight dependency failed.',
      { port },
    );
  }
}

function evaluateReadResponse(port, evaluator, signal) {
  abort(signal);
  try {
    const result = evaluator();
    abort(signal);
    return result;
  } catch {
    abort(signal);
    throw new StudioError(
      'PROCESSING_ADOPTION_PREFLIGHT_PORT_RESPONSE_INVALID',
      'A read-only processing adoption preflight dependency returned invalid evidence.',
      { port },
    );
  }
}

function hasErrorFindings(request) {
  return request.processingResult.findings.some(({ severity }) => severity === 'ERROR');
}

function receipt(request, {
  capabilityCheck = uncheckedProcessingAdoptionCapability(),
  assetStateCheck = uncheckedProcessingAdoptionAssetState(),
  artifactChecks = uncheckedProcessingAdoptionArtifacts(),
} = {}) {
  return createProcessingAdoptionPreflightReceipt(request, {
    capabilityCheck,
    assetStateCheck,
    artifactChecks,
  });
}

/**
 * Performs an observation-only preflight. The service has no mutation port,
 * grant, owner decision, lease, persistence, or materialization dependency.
 */
export class ProcessingAdoptionPreflightService {
  #capabilityProvider;

  #assetStateReader;

  #artifactVerifier;

  constructor({ capabilityProvider, assetStateReader, artifactVerifier } = {}) {
    invariant(
      capabilityProvider !== null && capabilityProvider !== undefined,
      'PROCESSING_ADOPTION_PREFLIGHT_PORT_INVALID',
      'A project capability provider is required.',
      { port: 'capabilityProvider' },
    );
    this.#capabilityProvider = validateTrustedCapabilityProvider(capabilityProvider);
    this.#assetStateReader = validateProcessingAdoptionAssetStateReader(assetStateReader);
    this.#artifactVerifier = validateProcessingAdoptionArtifactVerifier(artifactVerifier);
  }

  async preflight(requestValue, { signal } = {}) {
    const request = validateProcessingAdoptionPreflightRequest(requestValue);
    abort(signal);
    if (hasErrorFindings(request)) return receipt(request);

    const capabilitySelection = projectCapabilitySelection({
      projectId: request.project.projectId,
      revision: request.project.expectedRevision,
    });
    const manifest = await invokeReadPort(
      'capabilityProvider',
      () => this.#capabilityProvider.getProjectCapabilityManifest(
        capabilitySelection,
        Object.freeze({ signal }),
      ),
      signal,
    );
    const capabilityCheck = evaluateReadResponse(
      'capabilityProvider',
      () => evaluateProcessingAdoptionCapability(request, manifest),
      signal,
    );
    if (capabilityCheck.status !== 'SUPPORTED') return receipt(request, { capabilityCheck });

    const assetSelection = deepFreeze({
      schemaVersion: PROCESSING_ADOPTION_ASSET_STATE_READER_SCHEMA_VERSION,
      projectId: request.project.projectId,
      revision: request.project.expectedRevision,
      assetId: request.target.assetId,
    });
    const assetEvidence = await invokeReadPort(
      'assetStateReader',
      () => this.#assetStateReader.readAssetState(assetSelection, Object.freeze({ signal })),
      signal,
    );
    const assetStateCheck = evaluateReadResponse(
      'assetStateReader',
      () => evaluateProcessingAdoptionAssetState(request, assetEvidence),
      signal,
    );
    if (assetStateCheck.status !== 'MATCHED') {
      return receipt(request, { capabilityCheck, assetStateCheck });
    }

    const artifactChecks = [];
    for (const role of PROCESSING_ADOPTION_PREFLIGHT_ARTIFACT_ROLES) {
      const descriptor = role === 'recipe-input'
        ? request.processingRecipe.inputs[0]
        : request.assetInputSelection.selectedOutput;
      const artifactSelection = deepFreeze({
        schemaVersion: PROCESSING_ADOPTION_ARTIFACT_VERIFIER_SCHEMA_VERSION,
        projectId: request.project.projectId,
        revision: request.project.expectedRevision,
        role,
        sha256: descriptor.sha256,
      });
      const evidence = await invokeReadPort(
        'artifactVerifier',
        () => this.#artifactVerifier.verifyProjectArtifact(
          artifactSelection,
          Object.freeze({ signal }),
        ),
        signal,
      );
      artifactChecks.push(evaluateReadResponse(
        'artifactVerifier',
        () => evaluateProcessingAdoptionArtifact(request, role, evidence),
        signal,
      ));
    }
    return receipt(request, { capabilityCheck, assetStateCheck, artifactChecks });
  }
}
