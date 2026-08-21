function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

const id = { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' };
const nonEmpty = { type: 'string', minLength: 1 };

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
          properties: {
            prompt: nonEmpty,
            seed: { type: ['string', 'number', 'null'] },
            model: { type: ['string', 'null'] },
            generator: { type: ['string', 'null'] },
          },
        },
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
