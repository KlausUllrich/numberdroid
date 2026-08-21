function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

const id = { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' };
const nonEmpty = { type: 'string', minLength: 1 };
const nullableShortText = { type: ['string', 'null'], maxLength: 500 };
const provenanceV2 = {
  type: 'object',
  additionalProperties: false,
  required: [
    'origin', 'prompt', 'negativePrompt', 'seed', 'provider', 'model', 'modelVersion',
    'generator', 'parameters', 'referenceArtifactUris', 'parentSourceIds',
  ],
  properties: {
    origin: { type: 'string', enum: ['human_upload', 'imported_generation'] },
    prompt: { type: ['string', 'null'], maxLength: 20000 },
    negativePrompt: { type: ['string', 'null'], maxLength: 20000 },
    seed: { type: ['string', 'number', 'null'] },
    provider: nullableShortText,
    model: nullableShortText,
    modelVersion: nullableShortText,
    generator: nullableShortText,
    parameters: { type: 'object' },
    referenceArtifactUris: {
      type: 'array',
      maxItems: 100,
      items: { type: 'string', format: 'uri' },
    },
    parentSourceIds: { type: 'array', maxItems: 100, uniqueItems: true, items: id },
  },
};

const atlasRectangle = {
  type: 'object',
  additionalProperties: false,
  required: [
    'rectangleId', 'x', 'y', 'width', 'height', 'included', 'pivot',
    'transparentPaddingPolicy', 'replacesSliceId', 'expectedSliceVersion',
  ],
  properties: {
    rectangleId: id,
    x: { type: 'integer', minimum: 0 },
    y: { type: 'integer', minimum: 0 },
    width: { type: 'integer', minimum: 1 },
    height: { type: 'integer', minimum: 1 },
    included: { type: 'boolean' },
    pivot: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['x', 'y'],
      properties: { x: { type: 'integer', minimum: 0 }, y: { type: 'integer', minimum: 0 } },
    },
    transparentPaddingPolicy: { type: 'string', enum: ['preserve_exact_rect'] },
    replacesSliceId: { ...id, type: ['string', 'null'] },
    expectedSliceVersion: { type: ['integer', 'null'], minimum: 1 },
  },
};

const definitions = [
  {
    type: 'project.create',
    toolName: 'studio_project_create',
    description: 'Create a Studio project and its immutable first revision.',
    requiredScope: null,
    ownerOnly: false,
    payloadSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'ownerId'],
      properties: {
        name: { ...nonEmpty, maxLength: 160 },
        description: { type: 'string', maxLength: 2000 },
        ownerId: id,
      },
    },
  },
  {
    type: 'grant.issue',
    toolName: 'studio_grant_issue',
    description: 'Issue a time-bounded, task-scoped capability grant to an agent.',
    requiredScope: 'grant.manage',
    ownerOnly: true,
    payloadSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['grantId', 'agentId', 'taskId', 'branchId', 'scopes', 'objectScopes', 'budget'],
      properties: {
        grantId: id,
        agentId: id,
        taskId: id,
        branchId: id,
        scopes: { type: 'array', minItems: 1, uniqueItems: true, items: nonEmpty },
        objectScopes: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'id'],
            properties: { kind: nonEmpty, id },
          },
        },
        budget: {
          type: 'object',
          additionalProperties: false,
          required: ['maxCommands', 'maxJobs', 'maxArtifactBytes'],
          properties: {
            maxCommands: { type: 'integer', minimum: 1 },
            maxJobs: { type: 'integer', minimum: 0 },
            maxArtifactBytes: { type: 'integer', minimum: 0 },
            maxCostCents: { type: 'integer', minimum: 0 },
          },
        },
        expiresAt: { type: ['string', 'null'], format: 'date-time' },
      },
    },
  },
  {
    type: 'grant.revoke',
    toolName: 'studio_grant_revoke',
    description: 'Revoke a previously issued agent capability grant.',
    requiredScope: 'grant.manage',
    ownerOnly: true,
    payloadSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['grantId'],
      properties: { grantId: id, reason: { type: 'string', maxLength: 500 } },
    },
  },
  {
    type: 'project.status.set',
    toolName: 'studio_project_status_set',
    description: 'Move the project through an explicit human-visible lifecycle state.',
    requiredScope: 'project.status.write',
    ownerOnly: false,
    payloadSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['status'],
      properties: {
        status: { type: 'string', enum: ['draft', 'active', 'paused', 'in_review', 'archived'] },
        note: { type: 'string', maxLength: 1000 },
      },
    },
  },
  {
    type: 'source.register',
    toolName: 'studio_source_register',
    description: 'Register an atlas or source image by artifact URI together with reproducible provenance.',
    requiredScope: 'source.write',
    ownerOnly: false,
    payloadSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['sourceId', 'name', 'artifactUri', 'mediaType', 'provenance'],
      properties: {
        sourceId: id,
        name: { ...nonEmpty, maxLength: 160 },
        artifactUri: { type: 'string', format: 'uri' },
        mediaType: { type: 'string', enum: ['image/png', 'image/webp'] },
        width: { type: 'integer', minimum: 1 },
        height: { type: 'integer', minimum: 1 },
        provenance: {
          type: 'object',
          required: ['prompt'],
          additionalProperties: false,
          properties: {
            prompt: { ...nonEmpty, maxLength: 20000 },
            seed: { type: ['string', 'number', 'null'] },
            model: { type: ['string', 'null'], maxLength: 200 },
            generator: { type: ['string', 'null'], maxLength: 200 },
          },
        },
      },
    },
  },
  {
    type: 'source.intake.commit',
    toolName: 'studio_source_intake_commit',
    description: 'Claim a project-scoped staged source intake and commit its provider-neutral provenance.',
    requiredScope: 'source.intake.commit',
    requiredObjectScope: 'project',
    ownerOnly: false,
    requiresDurableAgentLedger: true,
    payloadSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['intakeId', 'sourceId', 'name', 'artifactUri', 'mediaType', 'byteSize', 'width', 'height', 'provenance'],
      properties: {
        intakeId: id,
        sourceId: id,
        name: { ...nonEmpty, maxLength: 160 },
        artifactUri: { type: 'string', format: 'uri' },
        mediaType: { type: 'string', enum: ['image/png', 'image/webp'] },
        byteSize: { type: 'integer', minimum: 1 },
        width: { type: 'integer', minimum: 1 },
        height: { type: 'integer', minimum: 1 },
        provenance: provenanceV2,
      },
    },
  },
  {
    type: 'source.review.propose',
    toolName: 'studio_source_review_propose',
    description: 'Propose a registered source for explicit human review without deciding approval.',
    requiredScope: 'source.review.propose',
    requiredObjectScope: 'project',
    ownerOnly: false,
    requiresDurableAgentLedger: true,
    payloadSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['sourceId'],
      properties: {
        sourceId: id,
        note: { type: ['string', 'null'], maxLength: 2000 },
      },
    },
  },
  {
    type: 'source.review.decide',
    toolName: 'studio_source_review_decide',
    description: 'Record the project owner\'s explicit approval or rejection of a proposed source.',
    requiredScope: 'source.review.decide',
    ownerOnly: true,
    payloadSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['sourceId', 'disposition'],
      properties: {
        sourceId: id,
        disposition: { type: 'string', enum: ['APPROVED', 'REJECTED'] },
        note: { type: ['string', 'null'], maxLength: 2000 },
      },
    },
  },
  {
    type: 'atlas.define.rects',
    toolName: 'studio_atlas_define_rects',
    description: 'Create or revise explicit source-resolution rectangles for an approved PNG source.',
    requiredScope: 'atlas.write',
    requiredObjectScope: 'project',
    ownerOnly: false,
    requiresDurableAgentLedger: true,
    payloadSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['atlasId', 'sourceId', 'name', 'expectedAtlasVersion', 'rectangles'],
      properties: {
        atlasId: id,
        sourceId: id,
        name: { ...nonEmpty, maxLength: 160 },
        expectedAtlasVersion: { type: 'integer', minimum: 0 },
        rectangles: { type: 'array', minItems: 1, maxItems: 64, items: atlasRectangle },
      },
    },
  },
  {
    type: 'atlas.preview.slices',
    toolName: 'studio_atlas_preview_slices',
    description: 'Start a durable deterministic crop preview for the current approved atlas definition.',
    requiredScope: 'atlas.write',
    requiredObjectScope: 'project',
    ownerOnly: false,
    requiresDurableAgentLedger: true,
    requiresDurableJobStore: true,
    payloadSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['atlasId', 'expectedAtlasVersion', 'expectedDefinitionFingerprint', 'jobId'],
      properties: {
        atlasId: id,
        expectedAtlasVersion: { type: 'integer', minimum: 1 },
        expectedDefinitionFingerprint: { type: 'string', pattern: '^[a-f0-9]{64}$' },
        jobId: id,
      },
    },
  },
  {
    type: 'atlas.commit.slices',
    toolName: 'studio_atlas_commit_slices',
    description: 'Atomically promote one succeeded preview job into stable atlas slice heads.',
    requiredScope: 'atlas.write',
    requiredObjectScope: 'project',
    ownerOnly: false,
    requiresDurableAgentLedger: true,
    requiresDurableJobStore: true,
    payloadSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['atlasId', 'expectedAtlasVersion', 'expectedDefinitionFingerprint', 'jobId'],
      properties: {
        atlasId: id,
        expectedAtlasVersion: { type: 'integer', minimum: 1 },
        expectedDefinitionFingerprint: { type: 'string', pattern: '^[a-f0-9]{64}$' },
        jobId: id,
      },
    },
  },
  {
    type: 'asset.define',
    toolName: 'studio_asset_define',
    description: 'Define a semantic surface, prop, or item as a crop from a registered source.',
    requiredScope: 'asset.write',
    ownerOnly: false,
    payloadSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['assetId', 'sourceId', 'name', 'kind', 'region'],
      properties: {
        assetId: id,
        sourceId: id,
        name: { ...nonEmpty, maxLength: 160 },
        kind: { type: 'string', enum: ['surface', 'prop', 'item'] },
        region: {
          type: 'object',
          additionalProperties: false,
          required: ['x', 'y', 'width', 'height'],
          properties: {
            x: { type: 'integer', minimum: 0 },
            y: { type: 'integer', minimum: 0 },
            width: { type: 'integer', minimum: 1 },
            height: { type: 'integer', minimum: 1 },
          },
        },
        properties: { type: 'object' },
        status: { type: 'string', enum: ['draft', 'in_review'] },
      },
    },
  },
];

export const COMMAND_DEFINITIONS = deepFreeze(definitions);

export function getCommandDefinition(type) {
  return COMMAND_DEFINITIONS.find((definition) => definition.type === type) ?? null;
}

export function listCommandDefinitions() {
  return structuredClone(COMMAND_DEFINITIONS);
}

export const KNOWN_GRANT_SCOPES = deepFreeze([
  'project.read',
  ...new Set(COMMAND_DEFINITIONS.map((definition) => definition.requiredScope).filter(Boolean)),
]);
