import { CLIP_COMMAND_DEFINITIONS } from './clip-command-catalog.js';
import { ASSEMBLY_COMMAND_DEFINITIONS } from './assembly-command-catalog.js';
import { ASSEMBLY_ANY_DECLARATION_SCHEMA } from './assembly-geometry.js';

const id = { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' };
const ids = { type: 'array', maxItems: 64, uniqueItems: true, items: id };
const object = properties => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const image = object({ assetId: id, operation: { type: 'string', enum: ['create', 'update'] }, expectedAssetVersion: { type: 'integer', minimum: 0 }, expectedMetadataVersion: { type: 'integer', minimum: 0 },
  name: { type: 'string', minLength: 1, maxLength: 160 }, kind: { type: 'string', enum: ['surface', 'prop', 'item'] }, metadata: { type: 'object' },
  image: { oneOf: [object({ mode: { type: 'string', const: 'retain' } }), object({ mode: { type: 'string', const: 'saved-slice' }, sliceId: id, expectedSliceVersion: { type: 'integer', minimum: 1 } })] } });
const animation = CLIP_COMMAND_DEFINITIONS.find(entry => entry.type === 'clip.save').payloadSchema;
const assembly = structuredClone(ASSEMBLY_COMMAND_DEFINITIONS.find(entry => entry.type === 'assembly.save').payloadSchema);
assembly.properties.assembly = ASSEMBLY_ANY_DECLARATION_SCHEMA;
const common = { reviewId: id, expectedReviewVersion: { type: 'integer', minimum: 1 } };
const confirmed = { type: 'boolean', const: true };
const owner = (type, description, fields) => ({ type, toolName: `studio_${type.replaceAll('.', '_')}`, description, ownerOnly: true, requiredScope: null, requiresDurableReviewStore: true, payloadSchema: object({ ...common, ...fields, confirmed }) });
export const REVIEW_COMMAND_DEFINITIONS = [
  { type: 'review.proposal.submit', toolName: 'studio_review_proposal_submit', description: 'Submit a related Image, Animation and Assembly Review or revise its exact remaining changes-requested content.', ownerOnly: false, requiredScope: 'review.proposal.submit', requiredObjectScope: 'project', requiresDurableAgentLedger: true, requiresDurableReviewStore: true, requiresReviewProfile: true,
    payloadSchema: object({ reviewId: id, expectedReviewVersion: { type: 'integer', minimum: 0 }, title: { type: 'string', minLength: 1, maxLength: 160 }, items: { type: 'array', minItems: 1, maxItems: 64,
      items: { oneOf: Object.entries({ image, animation, assembly }).map(([kind, schema]) => object({ itemId: id, contentKind: { type: 'string', const: kind }, payload: schema, dependsOn: ids })) } } }) },
  owner('review.feedback.save', 'Save or amend owner feedback for exact remaining Review items without changing saved content.', { summary: { type: 'string', minLength: 1, maxLength: 4000 }, itemComments: { type: 'array', maxItems: 64, items: object({ itemId: id, text: { type: 'string', minLength: 1, maxLength: 2000 } }) } }),
  owner('review.accept', 'Accept a dependency-valid subset of the exact Review once in one atomic content revision.', { selectedItemIds: { ...ids, minItems: 1 } }),
  owner('review.discard', 'Discard only the remaining Review work while preserving previously accepted content.', {}),
];
export const REVIEW_QUERY_SCHEMA = { type: 'object', additionalProperties: false, required: ['schemaVersion', 'projectId'], properties: {
  schemaVersion: { type: 'integer', const: 1 }, projectId: id, reviewId: id, reviewVersion: { type: 'integer', minimum: 1 }, limit: { type: 'integer', minimum: 1, maximum: 100 },
  includeHistory: { type: 'boolean' }, selectedItemIds: ids, expectedRevision: { type: 'integer', minimum: 1 }, selection: { type: 'object', additionalProperties: false, properties: { stateId: id, variantId: id } },
} };
