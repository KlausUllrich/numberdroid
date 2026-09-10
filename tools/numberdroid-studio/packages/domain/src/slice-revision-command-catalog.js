const id = { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' };
const version = { type: 'integer', minimum: 1 };
const common = { sliceId: id, expectedSliceVersion: version, expectedAtlasVersion: version, jobId: id };
export const SLICE_REVISION_COMMAND_DEFINITIONS = [
  { type: 'slice.revision.prepare', toolName: 'studio_slice_revision_prepare',
    description: 'Prepare one exact source-cut revision while retaining the atlas and all other cuts; matching saved content is reused.',
    ownerOnly: false, requiredScope: 'slice.revision.prepare', requiredObjectScope: 'project',
    requiresDurableAgentLedger: true, requiresDurableJobStore: true, requiresDurableClipStore: true, requiresAnimationProfile: true,
    payloadSchema: { type: 'object', additionalProperties: false,
      required: [...Object.keys(common), 'sourceSliceVersion', 'name', 'rectangle'], properties: { ...common, sourceSliceVersion: version,
        name: { type: 'string', minLength: 1, maxLength: 160 }, rectangle: { type: 'object', additionalProperties: false,
          required: ['x', 'y', 'width', 'height'], properties: { x: { type: 'integer', minimum: 0, maximum: 4095 }, y: { type: 'integer', minimum: 0, maximum: 4095 },
            width: { type: 'integer', minimum: 1, maximum: 4096 }, height: { type: 'integer', minimum: 1, maximum: 4096 } } } } } },
  { type: 'slice.revision.commit', toolName: 'studio_slice_revision_commit',
    description: 'Commit one succeeded cut-revision job with exact current cut and atlas versions, preserving other saved content.',
    ownerOnly: false, requiredScope: 'slice.revision.commit', requiredObjectScope: 'project',
    requiresDurableAgentLedger: true, requiresDurableJobStore: true, requiresDurableClipStore: true, requiresAnimationProfile: true,
    payloadSchema: { type: 'object', additionalProperties: false, required: Object.keys(common), properties: common } },
];
