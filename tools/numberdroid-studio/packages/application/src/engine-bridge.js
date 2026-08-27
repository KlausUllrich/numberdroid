import {
  candidateManifestSha256,
  validateCandidateManifest,
} from '../../domain/src/candidate-manifest.js';
import { StudioError, invariant } from '../../domain/src/errors.js';
import { deepFreeze } from './value-utils.js';

export const ENGINE_BRIDGE_PORT_SCHEMA_VERSION = 1;
export const ENGINE_BRIDGE_PORT_KIND = 'studio.engine-bridge';
export const ENGINE_BRIDGE_PORT_MODE = 'VALIDATE_ONLY';
export const ENGINE_BRIDGE_PORT_DIRECTION = 'CANDIDATE_TO_ENGINE';
export const ENGINE_BRIDGE_CANDIDATE_SELECTION_KIND = 'studio.engine-bridge.candidate-selection';
export const ENGINE_BRIDGE_VALIDATION_RECEIPT_KIND = 'studio.engine-bridge.validation-receipt';

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const NAMESPACED_ID_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+$/;
const STABLE_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@+-]{0,255}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

function exactFields(value, allowed, label) {
  invariant(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'ENGINE_BRIDGE_INVALID',
    `${label} must be an object.`,
    { field: label },
  );
  for (const field of Object.keys(value)) {
    invariant(
      allowed.includes(field),
      'ENGINE_BRIDGE_FIELD_FORBIDDEN',
      `${label}.${field} is not permitted by the validate-only EngineBridge v1 port.`,
      { field: `${label}.${field}` },
    );
  }
  return value;
}

function requireString(value, label, { max = 256 } = {}) {
  invariant(
    typeof value === 'string'
      && value.length >= 1
      && value.length <= max
      && value.trim() === value
      && !CONTROL_CHARACTER_PATTERN.test(value),
    'ENGINE_BRIDGE_INVALID',
    `${label} must be a bounded trimmed string without control characters.`,
    { field: label },
  );
  return value;
}

function requireNamespacedId(value, label) {
  const id = requireString(value, label, { max: 128 });
  invariant(
    NAMESPACED_ID_PATTERN.test(id),
    'ENGINE_BRIDGE_INVALID',
    `${label} must be a lowercase dotted identifier.`,
    { field: label, value: id },
  );
  return id;
}

function requireVersion(value, label) {
  const version = requireString(value, label);
  invariant(
    STABLE_VERSION_PATTERN.test(version),
    'ENGINE_BRIDGE_INVALID',
    `${label} must be a portable stable version reference.`,
    { field: label, value: version },
  );
  return version;
}

function requireHash(value, label) {
  invariant(
    typeof value === 'string' && HASH_PATTERN.test(value),
    'ENGINE_BRIDGE_INVALID',
    `${label} must be a lowercase SHA-256 digest.`,
    { field: label },
  );
  return value;
}

function normalizeBridgeIdentity(value, label = 'bridge') {
  const bridge = exactFields(value, ['id', 'version'], label);
  return {
    id: requireNamespacedId(bridge.id, `${label}.id`),
    version: requireVersion(bridge.version, `${label}.version`),
  };
}

/**
 * Defines the safe common denominator for EngineBridge v1.
 *
 * This port can revalidate an immutable candidate against a downstream engine
 * or project boundary. It deliberately has no destination, materialization,
 * commit, publish, review, approval, or round-trip member. Those contracts need
 * a later product and authority decision.
 */
export function validateEngineBridgePort(value) {
  const port = exactFields(value, [
    'schemaVersion', 'kind', 'mode', 'direction', 'bridge', 'validateCandidate',
  ], 'engineBridge');
  invariant(
    port.schemaVersion === ENGINE_BRIDGE_PORT_SCHEMA_VERSION,
    'ENGINE_BRIDGE_SCHEMA_UNSUPPORTED',
    'Unsupported EngineBridge port schema version.',
    { value: port.schemaVersion },
  );
  invariant(
    port.kind === ENGINE_BRIDGE_PORT_KIND,
    'ENGINE_BRIDGE_INVALID',
    'EngineBridge port kind is invalid.',
    { value: port.kind },
  );
  invariant(
    port.mode === ENGINE_BRIDGE_PORT_MODE,
    'ENGINE_BRIDGE_INVALID',
    'EngineBridge v1 is validate-only.',
    { value: port.mode },
  );
  invariant(
    port.direction === ENGINE_BRIDGE_PORT_DIRECTION,
    'ENGINE_BRIDGE_INVALID',
    'EngineBridge v1 is one-way from candidate to engine.',
    { value: port.direction },
  );
  invariant(
    typeof port.validateCandidate === 'function',
    'ENGINE_BRIDGE_INVALID',
    'EngineBridge v1 must expose validateCandidate(selection, context).',
  );
  const bridge = deepFreeze(normalizeBridgeIdentity(port.bridge));
  const implementation = port.validateCandidate;
  const validateCandidate = (selection, context) => implementation.call(port, selection, context);
  return Object.freeze({
    schemaVersion: ENGINE_BRIDGE_PORT_SCHEMA_VERSION,
    kind: ENGINE_BRIDGE_PORT_KIND,
    mode: ENGINE_BRIDGE_PORT_MODE,
    direction: ENGINE_BRIDGE_PORT_DIRECTION,
    bridge,
    validateCandidate,
  });
}

export function createEngineBridgeCandidateSelection(candidateManifest) {
  const manifest = validateCandidateManifest(candidateManifest);
  invariant(
    manifest.status === 'VERIFIED',
    'ENGINE_BRIDGE_CANDIDATE_NOT_VERIFIED',
    'EngineBridge validation requires a verified candidate manifest.',
    { status: manifest.status },
  );
  return deepFreeze({
    schemaVersion: ENGINE_BRIDGE_PORT_SCHEMA_VERSION,
    kind: ENGINE_BRIDGE_CANDIDATE_SELECTION_KIND,
    candidateFingerprint: candidateManifestSha256(manifest),
    candidateManifest: manifest,
  });
}

export function validateEngineBridgeCandidateSelection(value) {
  const selection = exactFields(value, [
    'schemaVersion', 'kind', 'candidateFingerprint', 'candidateManifest',
  ], 'selection');
  invariant(
    selection.schemaVersion === ENGINE_BRIDGE_PORT_SCHEMA_VERSION,
    'ENGINE_BRIDGE_SCHEMA_UNSUPPORTED',
    'Unsupported EngineBridge candidate selection schema version.',
    { value: selection.schemaVersion },
  );
  invariant(
    selection.kind === ENGINE_BRIDGE_CANDIDATE_SELECTION_KIND,
    'ENGINE_BRIDGE_INVALID',
    'EngineBridge candidate selection kind is invalid.',
    { value: selection.kind },
  );
  const expectedFingerprint = requireHash(selection.candidateFingerprint, 'selection.candidateFingerprint');
  const normalized = createEngineBridgeCandidateSelection(selection.candidateManifest);
  invariant(
    normalized.candidateFingerprint === expectedFingerprint,
    'ENGINE_BRIDGE_CANDIDATE_FINGERPRINT_MISMATCH',
    'EngineBridge candidate selection does not match its manifest fingerprint.',
    {
      expected: expectedFingerprint,
      actual: normalized.candidateFingerprint,
    },
  );
  return normalized;
}

export function validateEngineBridgeValidationReceipt(value, { bridge, selection } = {}) {
  const expectedPort = validateEngineBridgePort(bridge);
  const expectedSelection = validateEngineBridgeCandidateSelection(selection);
  const receipt = exactFields(value, [
    'schemaVersion', 'kind', 'status', 'bridge', 'candidateFingerprint', 'evidenceHash',
  ], 'receipt');
  invariant(
    receipt.schemaVersion === ENGINE_BRIDGE_PORT_SCHEMA_VERSION,
    'ENGINE_BRIDGE_SCHEMA_UNSUPPORTED',
    'Unsupported EngineBridge validation receipt schema version.',
    { value: receipt.schemaVersion },
  );
  invariant(
    receipt.kind === ENGINE_BRIDGE_VALIDATION_RECEIPT_KIND,
    'ENGINE_BRIDGE_INVALID',
    'EngineBridge validation receipt kind is invalid.',
    { value: receipt.kind },
  );
  invariant(
    receipt.status === 'VALIDATED',
    'ENGINE_BRIDGE_INVALID',
    'EngineBridge validation receipt status must be VALIDATED.',
    { value: receipt.status },
  );
  const receiptBridge = normalizeBridgeIdentity(receipt.bridge, 'receipt.bridge');
  const candidateFingerprint = requireHash(receipt.candidateFingerprint, 'receipt.candidateFingerprint');
  invariant(
    receiptBridge.id === expectedPort.bridge.id
      && receiptBridge.version === expectedPort.bridge.version,
    'ENGINE_BRIDGE_RECEIPT_MISMATCH',
    'EngineBridge validation receipt identifies a different bridge.',
    { expected: expectedPort.bridge, actual: receiptBridge },
  );
  invariant(
    candidateFingerprint === expectedSelection.candidateFingerprint,
    'ENGINE_BRIDGE_RECEIPT_MISMATCH',
    'EngineBridge validation receipt identifies a different candidate.',
    { expected: expectedSelection.candidateFingerprint, actual: candidateFingerprint },
  );
  return deepFreeze({
    schemaVersion: ENGINE_BRIDGE_PORT_SCHEMA_VERSION,
    kind: ENGINE_BRIDGE_VALIDATION_RECEIPT_KIND,
    status: 'VALIDATED',
    bridge: receiptBridge,
    candidateFingerprint,
    evidenceHash: requireHash(receipt.evidenceHash, 'receipt.evidenceHash'),
  });
}

export async function validateCandidateWithEngineBridge(bridgeValue, selectionValue, { signal } = {}) {
  const bridge = validateEngineBridgePort(bridgeValue);
  const selection = validateEngineBridgeCandidateSelection(selectionValue);
  signal?.throwIfAborted();
  let receipt;
  try {
    receipt = await bridge.validateCandidate(selection, Object.freeze({ signal }));
  } catch {
    signal?.throwIfAborted();
    throw new StudioError(
      'ENGINE_BRIDGE_VALIDATION_FAILED',
      'EngineBridge candidate validation failed.',
      { bridge: bridge.bridge },
    );
  }
  signal?.throwIfAborted();
  return validateEngineBridgeValidationReceipt(receipt, { bridge, selection });
}
