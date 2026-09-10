import { CLIP_DECLARATION_SCHEMA, CLIP_METADATA_SCHEMA } from './clip-definition.js';
const id = { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' };
const content = { assetId: id, operation: { type: 'string', enum: ['create', 'update'] },
  expectedAssetVersion: { type: 'integer', minimum: 0 }, expectedMetadataVersion: { type: 'integer', minimum: 0 },
  name: { type: 'string', minLength: 1, maxLength: 160 }, kind: { type: 'string', enum: ['surface', 'prop', 'item'] },
  metadata: CLIP_METADATA_SCHEMA, clip: CLIP_DECLARATION_SCHEMA };
export const CLIP_COMMAND_DEFINITIONS = [
  { type: 'clip.save', toolName: 'studio_clip_save', description: 'Save an owner-authored Animation clip with exact saved-cut frame versions.', ownerOnly: true, requiredScope: null, requiresDurableClipStore: true,
    payloadSchema: { type: 'object', additionalProperties: false, required: Object.keys(content), properties: content } },
  { type: 'clip.proposal.submit', toolName: 'studio_clip_proposal_submit', description: 'Submit one Animation clip proposal or revise its exact changes-requested version.', ownerOnly: false, requiredScope: 'clip.proposal.submit', requiredObjectScope: 'project', requiresDurableAgentLedger: true, requiresDurableClipStore: true, requiresAnimationProfile: true,
    payloadSchema: { type: 'object', additionalProperties: false, required: [...Object.keys(content), 'proposalId', 'expectedProposalVersion'], properties: { ...content, proposalId: id, expectedProposalVersion: { type: 'integer', minimum: 0 } } } },
  { type: 'clip.proposal.resolve', toolName: 'studio_clip_proposal_resolve', description: 'Owner resolution of an exact clip proposal; acceptance saves the clip atomically.', ownerOnly: true, requiredScope: null, requiresDurableClipStore: true,
    payloadSchema: { type: 'object', additionalProperties: false, required: ['proposalId', 'expectedProposalVersion', 'decision', 'confirmed'], properties: { proposalId: id, expectedProposalVersion: { type: 'integer', minimum: 1 }, decision: { type: 'string', enum: ['ACCEPT', 'REQUEST_CHANGES', 'DISCARD'] }, feedback: { type: ['string', 'null'], minLength: 1, maxLength: 2000 }, confirmed: { type: 'boolean', const: true } } } },
];
export const CLIP_QUERY_SCHEMA = { type: 'object', additionalProperties: false, required: ['schemaVersion', 'projectId'], properties: {
  schemaVersion: { type: 'integer', const: 1 }, projectId: id, assetId: id, assetVersion: { type: 'integer', minimum: 1 }, proposalId: id, limit: { type: 'integer', minimum: 1, maximum: 100 },
} };
