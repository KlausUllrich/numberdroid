import { types as utilTypes } from 'node:util';
import {
  validateAuthoringV2Capabilities,
  validateAuthoringV2SurfaceNegotiation,
} from '../../application/src/index.js';
import {
  ASSET_INPUT_SELECTION_ASSET_KINDS,
  ASSET_INPUT_SELECTION_KIND,
  ATLAS_PROCESSOR_ID,
  AUTHORING_V2_FEATURE_ID,
  AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL,
  AUTHORING_V2_SCHEMA_VERSION,
  EXACT_PNG_CROP_OPERATION_KIND,
  MAX_ATLAS_INPUT_BYTES,
  MAX_ATLAS_OUTPUT_BYTES,
  MAX_ATLAS_RECTANGLES,
  MAX_ATLAS_SOURCE_DIMENSION,
  MAX_PROCESSING_RESULT_FINDINGS,
  PRIMARY_VISUAL_ASSET_INPUT_ROLE,
  PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID,
  PROCESSING_ADOPTION_PREFLIGHT_REQUEST_KIND,
  PROCESSING_RECIPE_KIND,
  PROCESSING_RESULT_ADOPTION_COMMAND_KIND,
  PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
  PROCESSING_RESULT_KIND,
  PROJECT_CAPABILITY_MANIFEST_KIND,
  StudioError,
  TRANSPARENT_PADDING_POLICY,
} from '../../domain/src/index.js';

export const AUTHORING_V2_CAPABILITIES_URI_TEMPLATE = 'studio://projects/{projectId}/capabilities';

export async function authorizeAgentProject(contextProvider, invocationContext, requestedProjectId) {
  const context = await contextProvider(invocationContext);
  if (!context?.projectId) {
    throw new StudioError(
      'UNTRUSTED_AGENT_CONTEXT',
      'The MCP host did not provide a trusted project binding.',
    );
  }
  if (context.projectId !== requestedProjectId) {
    throw new StudioError('CONTEXT_PROJECT_MISMATCH', 'The requested project is outside the MCP host context.', {
      contextProjectId: context.projectId,
      requestedProjectId,
    });
  }
  return context;
}

const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;
const ID_PATTERN = '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$';
const HASH_PATTERN = '^[a-f0-9]{64}$';
const CAS_URI_PATTERN = '^studio://artifacts/sha256/[a-f0-9]{64}$';
const TOKEN_PATTERN = '^[a-z][a-z0-9_-]{0,63}$';
const CAPABILITY_ID_PATTERN = '^[a-z][a-z0-9-]*(?:\\.[a-z0-9][a-z0-9-]*)+$';
const RESULT_RULE_ID_PATTERN = '^[a-z][a-z0-9_-]*(?:\\.[a-z0-9][a-z0-9_-]*)+$';
const STABLE_VERSION_PATTERN = '^[A-Za-z0-9][A-Za-z0-9._:@+-]{0,255}$';

function exactObject(properties, required = Object.keys(properties)) {
  return {
    type: 'object',
    additionalProperties: false,
    required,
    properties,
  };
}

function integer(minimum = 0, maximum = MAX_SAFE_INTEGER) {
  return { type: 'integer', minimum, maximum };
}

function stableId() {
  return { type: 'string', minLength: 1, maxLength: 128, pattern: ID_PATTERN };
}

function sha256() {
  return { type: 'string', minLength: 64, maxLength: 64, pattern: HASH_PATTERN };
}

function boundedArray(items, minItems, maxItems, { uniqueItems = false } = {}) {
  return { type: 'array', items, minItems, maxItems, uniqueItems };
}

function inputArtifactSchema() {
  return exactObject({
    inputId: stableId(),
    artifactUri: { type: 'string', pattern: CAS_URI_PATTERN },
    sha256: sha256(),
    mediaType: { type: 'string', enum: ['image/png'] },
    byteSize: integer(33, MAX_ATLAS_INPUT_BYTES),
    width: integer(1, MAX_ATLAS_SOURCE_DIMENSION),
    height: integer(1, MAX_ATLAS_SOURCE_DIMENSION),
  });
}

function outputArtifactSchema() {
  return exactObject({
    outputId: stableId(),
    artifactUri: { type: 'string', pattern: CAS_URI_PATTERN },
    sha256: sha256(),
    mediaType: { type: 'string', enum: ['image/png'] },
    byteSize: integer(33, MAX_ATLAS_OUTPUT_BYTES),
    width: integer(1, MAX_ATLAS_SOURCE_DIMENSION),
    height: integer(1, MAX_ATLAS_SOURCE_DIMENSION),
  });
}

function recipeSchema() {
  const rectangle = exactObject({
    outputId: stableId(),
    x: integer(),
    y: integer(),
    width: integer(1),
    height: integer(1),
    transparentPaddingPolicy: { type: 'string', enum: [TRANSPARENT_PADDING_POLICY] },
  });
  const operation = exactObject({
    operationId: stableId(),
    kind: { type: 'string', enum: [EXACT_PNG_CROP_OPERATION_KIND] },
    processorId: { type: 'string', enum: [ATLAS_PROCESSOR_ID] },
    inputId: stableId(),
    outputMediaType: { type: 'string', enum: ['image/png'] },
    parameters: exactObject({
      rectangles: boundedArray(rectangle, 1, MAX_ATLAS_RECTANGLES, { uniqueItems: true }),
    }),
  });
  return exactObject({
    schemaVersion: { type: 'integer', enum: [1] },
    kind: { type: 'string', enum: [PROCESSING_RECIPE_KIND] },
    recipeId: stableId(),
    recipeVersion: integer(1),
    inputs: boundedArray(inputArtifactSchema(), 1, 1),
    operations: boundedArray(operation, 1, 1),
  });
}

function resultSchema() {
  const finding = exactObject({
    severity: { type: 'string', enum: ['ERROR', 'WARNING', 'INFO'] },
    ruleId: { type: 'string', minLength: 3, maxLength: 128, pattern: RESULT_RULE_ID_PATTERN },
    objectRef: { type: 'string', minLength: 1, maxLength: 256 },
    explanation: { type: 'string', minLength: 1, maxLength: 2000 },
    remediation: { type: 'string', minLength: 1, maxLength: 2000 },
    validatorVersion: stableId(),
  });
  const operation = exactObject({
    operationId: stableId(),
    kind: { type: 'string', enum: [EXACT_PNG_CROP_OPERATION_KIND] },
    processorId: { type: 'string', enum: [ATLAS_PROCESSOR_ID] },
    inputs: boundedArray(inputArtifactSchema(), 1, 1),
    outputs: boundedArray(outputArtifactSchema(), 1, MAX_ATLAS_RECTANGLES),
  });
  return exactObject({
    schemaVersion: { type: 'integer', enum: [1] },
    kind: { type: 'string', enum: [PROCESSING_RESULT_KIND] },
    recipe: exactObject({
      id: stableId(),
      version: integer(1),
      fingerprint: sha256(),
    }),
    operations: boundedArray(operation, 1, 1),
    findings: boundedArray(finding, 0, MAX_PROCESSING_RESULT_FINDINGS, { uniqueItems: true }),
  });
}

function selectionSchema() {
  return exactObject({
    schemaVersion: { type: 'integer', enum: [1] },
    kind: { type: 'string', enum: [ASSET_INPUT_SELECTION_KIND] },
    assetKind: { type: 'string', enum: [...ASSET_INPUT_SELECTION_ASSET_KINDS] },
    inputRole: { type: 'string', enum: [PRIMARY_VISUAL_ASSET_INPUT_ROLE] },
    processingResult: exactObject({
      schemaVersion: { type: 'integer', enum: [1] },
      kind: { type: 'string', enum: [PROCESSING_RESULT_KIND] },
      fingerprint: sha256(),
    }),
    recipe: exactObject({
      id: stableId(),
      version: integer(1),
      fingerprint: sha256(),
    }),
    operation: exactObject({
      operationId: stableId(),
      kind: { type: 'string', enum: [EXACT_PNG_CROP_OPERATION_KIND] },
      processorId: { type: 'string', enum: [ATLAS_PROCESSOR_ID] },
    }),
    inputs: boundedArray(inputArtifactSchema(), 1, 1),
    selectedOutput: outputArtifactSchema(),
  });
}

function preflightRequestSchema() {
  return exactObject({
    schemaVersion: { type: 'integer', enum: [1] },
    kind: { type: 'string', enum: [PROCESSING_ADOPTION_PREFLIGHT_REQUEST_KIND] },
    project: exactObject({
      projectId: stableId(),
      expectedRevision: integer(1),
    }),
    processingRecipe: recipeSchema(),
    processingResult: resultSchema(),
    assetInputSelection: selectionSchema(),
    capability: exactObject({
      schemaVersion: { type: 'integer', enum: [1] },
      kind: { type: 'string', enum: [PROJECT_CAPABILITY_MANIFEST_KIND] },
      profileId: { type: 'string', minLength: 3, maxLength: 128, pattern: CAPABILITY_ID_PATTERN },
      profileVersion: integer(1),
      adapter: exactObject({
        id: { type: 'string', minLength: 1, maxLength: 64, pattern: TOKEN_PATTERN },
        version: { type: 'string', minLength: 1, maxLength: 256, pattern: STABLE_VERSION_PATTERN },
      }),
      manifestFingerprint: sha256(),
      operation: exactObject({
        id: { type: 'string', enum: [PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID] },
        version: { type: 'integer', enum: [1] },
      }),
    }),
    target: exactObject({
      operation: { type: 'string', enum: ['create', 'update'] },
      assetId: stableId(),
      expectedAssetVersion: integer(),
      expectedMetadataVersion: integer(),
    }),
  });
}

export function authoringV2ProcessingResultAdoptionInputSchema() {
  return exactObject({
    schemaVersion: { type: 'integer', enum: [AUTHORING_V2_SCHEMA_VERSION] },
    commandId: stableId(),
    idempotencyKey: stableId(),
    projectId: stableId(),
    baseRevision: integer(1, MAX_SAFE_INTEGER - 1),
    expectedVersion: integer(1, MAX_SAFE_INTEGER - 1),
    dryRun: { type: 'boolean' },
    payload: exactObject({
      preflightRequest: preflightRequestSchema(),
      assetName: {
        type: ['string', 'null'],
        minLength: 1,
        maxLength: 160,
      },
    }),
  });
}

function exactConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || utilTypes.isProxy(value)) {
    throw new StudioError('AUTHORING_V2_SURFACE_INVALID', 'Authoring-v2 MCP configuration is required.');
  }
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    throw new StudioError('AUTHORING_V2_SURFACE_INVALID', 'Authoring-v2 MCP configuration must be inspectable.');
  }
  if (keys.length !== 3
    || (prototype !== Object.prototype && prototype !== null)
    || !keys.every((key) => typeof key === 'string'
      && ['negotiation', 'projectId', 'expectedProfileFingerprint'].includes(key))) {
    throw new StudioError(
      'AUTHORING_V2_SURFACE_INVALID',
      'Authoring-v2 MCP configuration must contain exactly negotiation, projectId, and expectedProfileFingerprint.',
    );
  }
  const config = Object.create(null);
  for (const field of ['negotiation', 'projectId', 'expectedProfileFingerprint']) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, field);
    } catch {
      throw new StudioError('AUTHORING_V2_SURFACE_INVALID', 'Authoring-v2 MCP configuration must be inspectable.');
    }
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) {
      throw new StudioError(
        'AUTHORING_V2_SURFACE_INVALID',
        'Authoring-v2 MCP configuration fields must be enumerable own data fields.',
      );
    }
    config[field] = descriptor.value;
  }
  return Object.freeze(config);
}

function signalFrom(invocationContext) {
  return invocationContext?.mcpReq?.signal;
}

export function createAuthoringV2McpSurface(
  studioGateway,
  configValue,
  { authorizeProject } = {},
) {
  const config = exactConfig(configValue);
  if (typeof authorizeProject !== 'function'
    || typeof studioGateway?.readAuthoringV2Capabilities !== 'function'
    || typeof studioGateway?.adoptProcessingResult !== 'function') {
    throw new StudioError(
      'AUTHORING_V2_SURFACE_INVALID',
      'Authoring-v2 MCP requires project authorization and both negotiated gateway operations.',
    );
  }
  const expectations = Object.freeze({
    projectId: config.projectId,
    expectedProfileFingerprint: config.expectedProfileFingerprint,
  });
  const negotiation = validateAuthoringV2SurfaceNegotiation(config.negotiation, expectations);

  const tool = Object.freeze({
    name: AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL,
    title: 'Adopt an exact processing result',
    description: 'Dry-run or atomically adopt one exact processing result as a branch-local DRAFT Asset. This does not review, finalize, merge, materialize, or publish it.',
    inputSchema: authoringV2ProcessingResultAdoptionInputSchema(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    execute: async (input, invocationContext) => {
      if (!input || input.schemaVersion !== AUTHORING_V2_SCHEMA_VERSION || typeof input.dryRun !== 'boolean') {
        throw new StudioError(
          'AUTHORING_V2_REQUEST_INVALID',
          'The MCP adoption request must use Authoring-v2 schema 2 and explicitly select dryRun.',
        );
      }
      const opaqueHostContext = await authorizeProject(invocationContext, input.projectId);
      return studioGateway.adoptProcessingResult({
        schemaVersion: AUTHORING_V2_SCHEMA_VERSION,
        featureId: AUTHORING_V2_FEATURE_ID,
        toolName: AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL,
        dryRun: input.dryRun,
        command: {
          schemaVersion: 1,
          kind: PROCESSING_RESULT_ADOPTION_COMMAND_KIND,
          commandId: input.commandId,
          idempotencyKey: input.idempotencyKey,
          type: PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
          projectId: input.projectId,
          baseRevision: input.baseRevision,
          expectedVersion: input.expectedVersion,
          payload: input.payload,
        },
      }, opaqueHostContext, { signal: signalFrom(invocationContext) });
    },
  });

  return Object.freeze({
    negotiation,
    tool,
    async readCapabilities(invocationContext, requestedProjectId) {
      const opaqueHostContext = await authorizeProject(invocationContext, requestedProjectId);
      const capabilities = await studioGateway.readAuthoringV2Capabilities({
        schemaVersion: AUTHORING_V2_SCHEMA_VERSION,
        featureId: AUTHORING_V2_FEATURE_ID,
        projectId: requestedProjectId,
      }, opaqueHostContext, { signal: signalFrom(invocationContext) });
      return validateAuthoringV2Capabilities(capabilities, expectations);
    },
  });
}
