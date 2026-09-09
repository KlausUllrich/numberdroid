import { ASSEMBLY_DECLARATION_SCHEMA, ASSEMBLY_METADATA_SCHEMA } from './assembly-definition.js';

const id = { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' };
const content = {
  assetId: id, operation: { type: 'string', enum: ['create', 'update'] },
  expectedAssetVersion: { type: 'integer', minimum: 0 }, expectedMetadataVersion: { type: 'integer', minimum: 0 },
  name: { type: 'string', minLength: 1, maxLength: 160 }, kind: { type: 'string', enum: ['surface', 'prop', 'item'] },
  metadata: ASSEMBLY_METADATA_SCHEMA, assembly: ASSEMBLY_DECLARATION_SCHEMA,
};
export const ASSEMBLY_COMMAND_DEFINITIONS = [
  { type: 'assembly.save', toolName: 'studio_assembly_save', description: 'Save an exact owner-authored Assembly DRAFT.',
    ownerOnly: true, requiredScope: null, requiresDurableAssemblyStore: true,
    payloadSchema: { type: 'object', additionalProperties: false, required: Object.keys(content), properties: content } },
  { type: 'assembly.proposal.submit', toolName: 'studio_assembly_proposal_submit', description: 'Submit one isolated Assembly proposal or revise its exact changes-requested version.',
    ownerOnly: false, requiredScope: 'assembly.proposal.submit', requiredObjectScope: 'project', requiresDurableAgentLedger: true,
    requiresDurableAssemblyStore: true, requiresAssemblyProfile: true,
    payloadSchema: { type: 'object', additionalProperties: false, required: [...Object.keys(content), 'proposalId', 'expectedProposalVersion'],
      properties: { ...content, proposalId: id, expectedProposalVersion: { type: 'integer', minimum: 0 } } } },
  { type: 'assembly.proposal.resolve', toolName: 'studio_assembly_proposal_resolve', description: 'Owner resolution of an exact Assembly proposal; acceptance applies atomically.',
    ownerOnly: true, requiredScope: null, requiresDurableAssemblyStore: true,
    payloadSchema: { type: 'object', additionalProperties: false, required: ['proposalId', 'expectedProposalVersion', 'decision', 'confirmed'],
      properties: { proposalId: id, expectedProposalVersion: { type: 'integer', minimum: 1 },
        decision: { type: 'string', enum: ['ACCEPT', 'REQUEST_CHANGES', 'DISCARD'] }, feedback: { type: 'string', minLength: 1, maxLength: 2000 }, confirmed: { const: true, type: 'boolean' } } } },
];

export const ASSEMBLY_QUERY_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['schemaVersion', 'projectId'],
  properties: { schemaVersion: { type: 'integer', const: 1 }, projectId: id, assetId: id,
    assetVersion: { type: 'integer', minimum: 1 }, proposalId: id, limit: { type: 'integer', minimum: 1, maximum: 100 } },
};
