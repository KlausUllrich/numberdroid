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

const tileSpan = {
  type: ['object', 'null'],
  additionalProperties: false,
  required: ['width', 'height'],
  properties: {
    width: { type: 'integer', minimum: 1, maximum: 64 },
    height: { type: 'integer', minimum: 1, maximum: 64 },
  },
};

const collisionRect = {
  type: 'object',
  additionalProperties: false,
  required: ['x', 'y', 'width', 'height'],
  properties: {
    x: { type: 'number', minimum: 0, maximum: 64 },
    y: { type: 'number', minimum: 0, maximum: 64 },
    width: { type: 'number', exclusiveMinimum: 0, maximum: 64 },
    height: { type: 'number', exclusiveMinimum: 0, maximum: 64 },
  },
};

const assetMetadataV2 = {
  type: 'object',
  additionalProperties: false,
  required: [
    'role', 'tags', 'variantGroup', 'compatibilityGroups', 'spanTiles', 'anchor',
    'attachment', 'rotationPolicy', 'placement', 'collision', 'navigation',
    'runtimeEligible', 'connectors', 'continuityProfile', 'continuityTags',
    'selectionPriority', 'visualWeight', 'extensions',
  ],
  properties: {
    role: { type: ['string', 'null'], maxLength: 64 },
    tags: { type: 'array', maxItems: 32, uniqueItems: true, items: { type: 'string', maxLength: 64 } },
    variantGroup: { type: ['string', 'null'], maxLength: 128 },
    compatibilityGroups: { type: 'array', maxItems: 16, uniqueItems: true, items: { type: 'string', maxLength: 128 } },
    spanTiles: tileSpan,
    anchor: {
      type: ['object', 'null'], additionalProperties: false, required: ['x', 'y'],
      properties: { x: { type: 'integer', minimum: 0, maximum: 63 }, y: { type: 'integer', minimum: 0, maximum: 63 } },
    },
    attachment: { type: ['string', 'null'], enum: ['ground', 'wall', 'ceiling', 'free', null] },
    rotationPolicy: { type: ['string', 'null'], enum: ['fixed', 'cardinal', null] },
    placement: {
      type: 'object', additionalProperties: false,
      required: ['modes', 'wallSafe', 'tags', 'confirmation'],
      properties: {
        modes: { type: 'array', maxItems: 8, uniqueItems: true, items: { type: 'string', enum: ['manual', 'automatic', 'perimeter', 'threshold', 'overlay'] } },
        wallSafe: { type: ['boolean', 'null'] },
        tags: { type: 'array', maxItems: 32, uniqueItems: true, items: { type: 'string', maxLength: 64 } },
        confirmation: { type: 'string', enum: ['missing', 'proposed', 'confirmed'] },
      },
    },
    collision: {
      type: ['object', 'null'], additionalProperties: false,
      required: ['mode', 'bounds', 'parts'],
      properties: {
        mode: { type: 'string', enum: ['none', 'bounds', 'parts'] },
        bounds: { ...collisionRect, type: ['object', 'null'] },
        parts: { type: 'array', maxItems: 16, items: collisionRect },
      },
    },
    navigation: {
      type: ['object', 'null'], additionalProperties: false, required: ['effect', 'cost'],
      properties: {
        effect: { type: 'string', enum: ['passable', 'blocked', 'cost'] },
        cost: { type: ['number', 'null'], minimum: 1, maximum: 100 },
      },
    },
    runtimeEligible: { type: ['boolean', 'null'] },
    connectors: {
      type: 'array', maxItems: 4,
      items: {
        type: 'object', additionalProperties: false, required: ['edge', 'offset'],
        properties: {
          edge: { type: 'string', enum: ['north', 'east', 'south', 'west'] },
          offset: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
    continuityProfile: { type: ['string', 'null'], maxLength: 128 },
    continuityTags: { type: 'array', maxItems: 32, uniqueItems: true, items: { type: 'string', maxLength: 64 } },
    selectionPriority: { type: 'integer', minimum: -1000, maximum: 1000 },
    visualWeight: { type: ['string', 'null'], enum: ['light', 'medium', 'heavy', null] },
    extensions: { type: 'object', maxProperties: 32 },
  },
};

const assetProposalItem = {
  type: 'object',
  additionalProperties: false,
  required: [
    'itemId', 'operation', 'assetId', 'expectedAssetVersion', 'expectedMetadataVersion',
    'sliceId', 'expectedSliceVersion', 'name', 'kind', 'metadata',
  ],
  properties: {
    itemId: id,
    operation: { type: 'string', enum: ['create', 'update'] },
    assetId: id,
    expectedAssetVersion: { type: 'integer', minimum: 0 },
    expectedMetadataVersion: { type: 'integer', minimum: 0 },
    sliceId: id,
    expectedSliceVersion: { type: 'integer', minimum: 1 },
    name: { ...nonEmpty, maxLength: 160 },
    kind: { type: 'string', enum: ['surface', 'prop', 'item'] },
    metadata: assetMetadataV2,
  },
};

const roomIntent = {
  type: 'object', additionalProperties: false,
  required: ['layer', 'ruleId', 'summary', 'disposition'],
  properties: {
    layer: { type: 'string', enum: ['game_design', 'level_design', 'room_design'] },
    ruleId: id,
    summary: { ...nonEmpty, maxLength: 256 },
    disposition: { type: 'string', enum: ['governing', 'proposed'] },
  },
};

const roomConnector = {
  type: 'object', additionalProperties: false,
  required: ['connectorId', 'side', 'offset', 'width', 'kind', 'clearanceInside', 'clearanceOutside', 'required', 'tags', 'compatibilityProfile'],
  properties: {
    connectorId: id,
    side: { type: 'string', enum: ['north', 'east', 'south', 'west'] },
    offset: { type: 'integer', minimum: 0, maximum: 63 },
    width: { type: 'integer', minimum: 1, maximum: 64 },
    kind: { type: 'string', enum: ['opening', 'standard-door', 'controlled-door'] },
    clearanceInside: { type: 'integer', minimum: 0, maximum: 16 },
    clearanceOutside: { type: 'integer', minimum: 0, maximum: 16 },
    required: { type: 'boolean' },
    tags: { type: 'array', maxItems: 32, uniqueItems: true, items: { type: 'string', maxLength: 64 } },
    compatibilityProfile: { type: ['string', 'null'], maxLength: 128 },
  },
};

const roomPlacement = {
  type: 'object', additionalProperties: false,
  required: ['placementId', 'assetId', 'assetVersion', 'metadataVersion', 'layer', 'anchor', 'rotation', 'variantTag', 'proposalId', 'proposalItemId'],
  properties: {
    placementId: id,
    assetId: id,
    assetVersion: { type: 'integer', minimum: 1 },
    metadataVersion: { type: 'integer', minimum: 1 },
    layer: { type: 'string', enum: ['STRUCTURAL_SURFACE', 'SET_DRESSING'] },
    anchor: {
      type: 'object', additionalProperties: false, required: ['x', 'y'],
      properties: { x: { type: 'integer', minimum: 0, maximum: 63 }, y: { type: 'integer', minimum: 0, maximum: 63 } },
    },
    rotation: { type: 'integer', enum: [0, 90, 180, 270] },
    variantTag: { type: ['string', 'null'], maxLength: 128 },
    proposalId: { ...id, type: ['string', 'null'] },
    proposalItemId: { ...id, type: ['string', 'null'] },
  },
};

const roomPlacementProposalItem = {
  type: 'object', additionalProperties: false,
  required: ['itemId', 'operation', 'placement', 'placementId', 'expectedAssetId', 'anchor', 'rotation'],
  properties: {
    itemId: id,
    operation: { type: 'string', enum: ['add', 'move', 'remove'] },
    placement: { ...roomPlacement, type: ['object', 'null'] },
    placementId: { ...id, type: ['string', 'null'] },
    expectedAssetId: { ...id, type: ['string', 'null'] },
    anchor: {
      type: ['object', 'null'], additionalProperties: false, required: ['x', 'y'],
      properties: { x: { type: 'integer', minimum: 0, maximum: 63 }, y: { type: 'integer', minimum: 0, maximum: 63 } },
    },
    rotation: { type: ['integer', 'null'], enum: [0, 90, 180, 270, null] },
  },
};

const definitions = [
  {
    type: 'task.merge.revert',
    toolName: 'studio_task_merge_revert',
    description: 'Create a new owner-controlled compensating revision for one Checkpoint 4 task merge.',
    requiredScope: 'task.merge.revert',
    ownerOnly: true,
    payloadSchema: {
      type: 'object', additionalProperties: false, required: ['mergeId'],
      properties: { mergeId: id },
    },
  },
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
  {
    type: 'asset.proposal.submit',
    toolName: 'studio_asset_proposal_submit',
    description: 'Submit a durable bounded V2 asset proposal backed by exact committed slice versions.',
    requiredScope: 'asset.proposal.submit',
    requiredObjectScope: 'project',
    ownerOnly: false,
    requiresDurableAgentLedger: true,
    requiresDurableAssetStore: true,
    payloadSchema: {
      type: 'object', additionalProperties: false,
      required: ['proposalId', 'expectedRevision', 'items'],
      properties: {
        proposalId: id,
        expectedRevision: { type: 'integer', minimum: 1 },
        items: { type: 'array', minItems: 1, maxItems: 64, items: assetProposalItem },
      },
    },
  },
  {
    type: 'asset.proposal.decide',
    toolName: 'studio_asset_proposal_decide',
    description: 'Record one complete owner decision vector for a pending V2 asset proposal.',
    requiredScope: 'asset.proposal.decide',
    ownerOnly: true,
    requiresDurableAssetStore: true,
    payloadSchema: {
      type: 'object', additionalProperties: false,
      required: ['proposalId', 'expectedProposalVersion', 'decisions'],
      properties: {
        proposalId: id,
        expectedProposalVersion: { type: 'integer', minimum: 1 },
        decisions: {
          type: 'array', minItems: 1, maxItems: 64,
          items: {
            type: 'object', additionalProperties: false,
            required: ['itemId', 'disposition', 'reason'],
            properties: {
              itemId: id,
              disposition: { type: 'string', enum: ['ACCEPTED', 'REJECTED'] },
              reason: { type: ['string', 'null'], maxLength: 2000 },
            },
          },
        },
      },
    },
  },
  {
    type: 'asset.proposal.apply',
    toolName: 'studio_asset_proposal_apply',
    description: 'Atomically apply the accepted subset of one decided V2 asset proposal.',
    requiredScope: 'asset.proposal.apply',
    ownerOnly: true,
    requiresDurableAssetStore: true,
    payloadSchema: {
      type: 'object', additionalProperties: false,
      required: ['proposalId', 'expectedProposalVersion'],
      properties: {
        proposalId: id,
        expectedProposalVersion: { type: 'integer', minimum: 2 },
      },
    },
  },
  {
    type: 'asset.lifecycle.set',
    toolName: 'studio_asset_lifecycle_set',
    description: 'Promote one immutable V2 asset version through an owner-controlled lifecycle gate.',
    requiredScope: 'asset.lifecycle.set',
    ownerOnly: true,
    requiresDurableAssetStore: true,
    payloadSchema: {
      type: 'object', additionalProperties: false,
      required: ['assetId', 'expectedAssetVersion', 'expectedMetadataVersion', 'targetLifecycle', 'acceptedWarningFindingIds'],
      properties: {
        assetId: id,
        expectedAssetVersion: { type: 'integer', minimum: 1 },
        expectedMetadataVersion: { type: 'integer', minimum: 1 },
        targetLifecycle: { type: 'string', enum: ['METADATA_COMPLETE', 'VALIDATED', 'FINAL'] },
        acceptedWarningFindingIds: { type: 'array', maxItems: 1024, uniqueItems: true, items: { type: 'string', maxLength: 128 } },
      },
    },
  },
  {
    type: 'room.archetype.create',
    toolName: 'studio_room_archetype_create',
    description: 'Create one immutable room or hallway archetype version; agents require an isolated task branch.',
    requiredScope: 'room.archetype.create',
    ownerOnly: false,
    requiresTaskBranch: true,
    requiresDurableRoomStore: true,
    payloadSchema: {
      type: 'object', additionalProperties: false,
      required: ['roomArchetypeId', 'kind', 'displayName', 'tags', 'dimensionPolicy', 'structuralBands', 'orientation', 'connectorPolicy', 'allowedAssetKinds', 'allowedTags', 'requiredTags', 'rationality', 'governingRuleRefs'],
      properties: {
        roomArchetypeId: id,
        kind: { type: 'string', enum: ['room', 'hallway'] },
        displayName: { ...nonEmpty, maxLength: 160 },
        tags: { type: 'array', maxItems: 32, uniqueItems: true, items: { type: 'string', maxLength: 64 } },
        dimensionPolicy: {
          type: 'object', additionalProperties: false, required: ['width', 'height'],
          properties: Object.fromEntries(['width', 'height'].map((axis) => [axis, {
            type: 'object', additionalProperties: false, required: ['min', 'preferred', 'max'],
            properties: {
              min: { type: 'integer', minimum: 3, maximum: 64 },
              preferred: { type: 'integer', minimum: 3, maximum: 64 },
              max: { type: 'integer', minimum: 3, maximum: 64 },
            },
          }])),
        },
        structuralBands: {
          type: 'object', additionalProperties: false, required: ['left', 'right', 'top', 'bottom'],
          properties: Object.fromEntries(['left', 'right', 'top', 'bottom'].map((side) => [side, { type: 'integer', minimum: 0, maximum: 63 }])),
        },
        orientation: { type: 'string', enum: ['horizontal', 'vertical', 'any'] },
        connectorPolicy: {
          type: 'object', additionalProperties: false, required: ['min', 'max', 'requiredSides'],
          properties: {
            min: { type: 'integer', minimum: 0, maximum: 32 },
            max: { type: 'integer', minimum: 0, maximum: 32 },
            requiredSides: { type: 'array', maxItems: 4, uniqueItems: true, items: { type: 'string', enum: ['north', 'east', 'south', 'west'] } },
          },
        },
        allowedAssetKinds: { type: 'array', maxItems: 3, uniqueItems: true, items: { type: 'string', enum: ['surface', 'prop', 'item'] } },
        allowedTags: { type: 'array', maxItems: 32, uniqueItems: true, items: { type: 'string', maxLength: 64 } },
        requiredTags: { type: 'array', maxItems: 32, uniqueItems: true, items: { type: 'string', maxLength: 64 } },
        rationality: { type: 'string', enum: ['domestic', 'neutral', 'ritual', 'system'] },
        governingRuleRefs: {
          type: 'array', maxItems: 32,
          items: {
            type: 'object', additionalProperties: false, required: ['ruleId', 'summary'],
            properties: { ruleId: id, summary: { ...nonEmpty, maxLength: 256 } },
          },
        },
      },
    },
  },
  {
    type: 'room.variant.create',
    toolName: 'studio_room_variant_create',
    description: 'Create one DRAFT room variant against an exact archetype version; agents require an isolated task branch.',
    requiredScope: 'room.variant.create',
    ownerOnly: false,
    requiresTaskBranch: true,
    requiresDurableRoomStore: true,
    payloadSchema: {
      type: 'object', additionalProperties: false,
      required: ['roomVariantId', 'roomArchetypeId', 'archetypeVersion', 'displayName', 'width', 'height', 'intentTrace', 'connectors', 'placements'],
      properties: {
        roomVariantId: id,
        roomArchetypeId: id,
        archetypeVersion: { type: 'integer', minimum: 1 },
        displayName: { ...nonEmpty, maxLength: 160 },
        width: { type: 'integer', minimum: 3, maximum: 64 },
        height: { type: 'integer', minimum: 3, maximum: 64 },
        intentTrace: { type: 'array', maxItems: 32, items: roomIntent },
        connectors: { type: 'array', maxItems: 32, items: roomConnector },
        placements: { type: 'array', maxItems: 256, items: roomPlacement },
      },
    },
  },
  {
    type: 'room.variant.intent.set',
    toolName: 'studio_room_variant_intent_set',
    description: 'Create a new DRAFT room version with an explicit intent trace.',
    requiredScope: 'room.variant.intent.set', ownerOnly: false, requiresTaskBranch: true, requiresDurableRoomStore: true,
    payloadSchema: {
      type: 'object', additionalProperties: false, required: ['roomVariantId', 'expectedRoomVariantVersion', 'intentTrace'],
      properties: { roomVariantId: id, expectedRoomVariantVersion: { type: 'integer', minimum: 1 }, intentTrace: { type: 'array', maxItems: 32, items: roomIntent } },
    },
  },
  {
    type: 'room.variant.resize',
    toolName: 'studio_room_variant_resize',
    description: 'Create a resized DRAFT room version without silently clipping connectors or placements.',
    requiredScope: 'room.variant.resize', ownerOnly: false, requiresTaskBranch: true, requiresDurableRoomStore: true,
    payloadSchema: {
      type: 'object', additionalProperties: false, required: ['roomVariantId', 'expectedRoomVariantVersion', 'width', 'height', 'removePlacementIds', 'removeConnectorIds'],
      properties: {
        roomVariantId: id, expectedRoomVariantVersion: { type: 'integer', minimum: 1 },
        width: { type: 'integer', minimum: 3, maximum: 64 }, height: { type: 'integer', minimum: 3, maximum: 64 },
        removePlacementIds: { type: 'array', maxItems: 256, uniqueItems: true, items: id },
        removeConnectorIds: { type: 'array', maxItems: 32, uniqueItems: true, items: id },
      },
    },
  },
  {
    type: 'room.variant.connectors.set',
    toolName: 'studio_room_variant_connectors_set',
    description: 'Create a new DRAFT room version with an exact connector set.',
    requiredScope: 'room.variant.connectors.set', ownerOnly: false, requiresTaskBranch: true, requiresDurableRoomStore: true,
    payloadSchema: {
      type: 'object', additionalProperties: false, required: ['roomVariantId', 'expectedRoomVariantVersion', 'connectors'],
      properties: { roomVariantId: id, expectedRoomVariantVersion: { type: 'integer', minimum: 1 }, connectors: { type: 'array', maxItems: 32, items: roomConnector } },
    },
  },
  {
    type: 'room.variant.placements.add',
    toolName: 'studio_room_variant_placements_add',
    description: 'Create a new DRAFT room version by adding exact V2 asset placements.',
    requiredScope: 'room.variant.placements.add', ownerOnly: false, requiresTaskBranch: true, requiresDurableRoomStore: true,
    payloadSchema: {
      type: 'object', additionalProperties: false, required: ['roomVariantId', 'expectedRoomVariantVersion', 'placements'],
      properties: { roomVariantId: id, expectedRoomVariantVersion: { type: 'integer', minimum: 1 }, placements: { type: 'array', minItems: 1, maxItems: 64, items: roomPlacement } },
    },
  },
  {
    type: 'room.variant.placements.move',
    toolName: 'studio_room_variant_placements_move',
    description: 'Create a new DRAFT room version by moving exact existing placements.',
    requiredScope: 'room.variant.placements.move', ownerOnly: false, requiresTaskBranch: true, requiresDurableRoomStore: true,
    payloadSchema: {
      type: 'object', additionalProperties: false, required: ['roomVariantId', 'expectedRoomVariantVersion', 'moves'],
      properties: {
        roomVariantId: id, expectedRoomVariantVersion: { type: 'integer', minimum: 1 },
        moves: { type: 'array', minItems: 1, maxItems: 64, items: {
          type: 'object', additionalProperties: false, required: ['placementId', 'expectedAssetId', 'anchor', 'rotation'],
          properties: { placementId: id, expectedAssetId: id, anchor: roomPlacement.properties.anchor, rotation: roomPlacement.properties.rotation },
        } },
      },
    },
  },
  {
    type: 'room.variant.placements.remove',
    toolName: 'studio_room_variant_placements_remove',
    description: 'Create a new DRAFT room version by removing explicitly identified placements.',
    requiredScope: 'room.variant.placements.remove', ownerOnly: false, requiresTaskBranch: true, requiresDurableRoomStore: true,
    payloadSchema: {
      type: 'object', additionalProperties: false, required: ['roomVariantId', 'expectedRoomVariantVersion', 'placements'],
      properties: {
        roomVariantId: id, expectedRoomVariantVersion: { type: 'integer', minimum: 1 },
        placements: { type: 'array', minItems: 1, maxItems: 64, items: {
          type: 'object', additionalProperties: false, required: ['placementId', 'expectedAssetId'],
          properties: { placementId: id, expectedAssetId: id },
        } },
      },
    },
  },
  {
    type: 'room.placement.proposal.submit',
    toolName: 'studio_room_placement_proposal_submit',
    description: 'Submit one bounded durable placement-only proposal against an exact DRAFT room version.',
    requiredScope: 'room.proposal.submit', requiredObjectScope: 'project', ownerOnly: false,
    requiresDurableAgentLedger: true, requiresDurableAssetStore: true, requiresDurableRoomStore: true,
    payloadSchema: {
      type: 'object', additionalProperties: false, required: ['proposalId', 'roomVariantId', 'expectedRoomVariantVersion', 'items'],
      properties: {
        proposalId: id, roomVariantId: id, expectedRoomVariantVersion: { type: 'integer', minimum: 1 },
        items: { type: 'array', minItems: 1, maxItems: 64, items: roomPlacementProposalItem },
      },
    },
  },
  {
    type: 'room.placement.proposal.decide',
    toolName: 'studio_room_placement_proposal_decide',
    description: 'Record one complete owner decision vector for a pending room placement proposal.',
    requiredScope: 'room.placement.proposal.decide', ownerOnly: true, requiresDurableRoomStore: true,
    payloadSchema: {
      type: 'object', additionalProperties: false, required: ['proposalId', 'expectedProposalVersion', 'decisions'],
      properties: {
        proposalId: id, expectedProposalVersion: { type: 'integer', minimum: 1 },
        decisions: { type: 'array', minItems: 1, maxItems: 64, items: {
          type: 'object', additionalProperties: false, required: ['itemId', 'disposition', 'reason'],
          properties: { itemId: id, disposition: { type: 'string', enum: ['ACCEPTED', 'REJECTED'] }, reason: { type: ['string', 'null'], maxLength: 2000 } },
        } },
      },
    },
  },
  {
    type: 'room.placement.proposal.apply',
    toolName: 'studio_room_placement_proposal_apply',
    description: 'Atomically apply the accepted subset of one decided room placement proposal.',
    requiredScope: 'room.placement.proposal.apply', ownerOnly: true, requiresDurableRoomStore: true,
    payloadSchema: {
      type: 'object', additionalProperties: false, required: ['proposalId', 'expectedProposalVersion'],
      properties: { proposalId: id, expectedProposalVersion: { type: 'integer', minimum: 2 } },
    },
  },
  {
    type: 'room.variant.warning.disposition.set',
    toolName: 'studio_room_variant_warning_disposition_set',
    description: 'Create a new DRAFT or VALIDATED room version with explicit owner warning dispositions.',
    requiredScope: 'room.variant.warning.disposition.set', ownerOnly: true, requiresDurableRoomStore: true,
    payloadSchema: {
      type: 'object', additionalProperties: false, required: ['roomVariantId', 'expectedRoomVariantVersion', 'acceptedWarningFindingIds'],
      properties: { roomVariantId: id, expectedRoomVariantVersion: { type: 'integer', minimum: 1 }, acceptedWarningFindingIds: { type: 'array', maxItems: 128, uniqueItems: true, items: { type: 'string', maxLength: 128 } } },
    },
  },
  {
    type: 'room.variant.validate',
    toolName: 'studio_room_variant_validate',
    description: 'Promote one room version to VALIDATED after deterministic checks; agents require an isolated task branch.',
    requiredScope: 'room.variant.validate', ownerOnly: false, requiresTaskBranch: true, requiresDurableRoomStore: true,
    payloadSchema: {
      type: 'object', additionalProperties: false, required: ['roomVariantId', 'expectedRoomVariantVersion'],
      properties: { roomVariantId: id, expectedRoomVariantVersion: { type: 'integer', minimum: 1 } },
    },
  },
  {
    type: 'room.variant.finalize',
    toolName: 'studio_room_variant_finalize',
    description: 'Create one immutable FINAL room version after owner-controlled validation and warning disposition.',
    requiredScope: 'room.variant.finalize', ownerOnly: true, requiresDurableRoomStore: true,
    payloadSchema: {
      type: 'object', additionalProperties: false, required: ['roomVariantId', 'expectedRoomVariantVersion'],
      properties: { roomVariantId: id, expectedRoomVariantVersion: { type: 'integer', minimum: 1 } },
    },
  },
  {
    type: 'room.variant.fork',
    toolName: 'studio_room_variant_fork',
    description: 'Fork one immutable FINAL room version into its next DRAFT lineage version.',
    requiredScope: 'room.variant.fork', ownerOnly: true, requiresDurableRoomStore: true,
    payloadSchema: {
      type: 'object', additionalProperties: false, required: ['roomVariantId', 'expectedRoomVariantVersion'],
      properties: { roomVariantId: id, expectedRoomVariantVersion: { type: 'integer', minimum: 1 } },
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
