import { invariant } from '../../../domain/src/errors.js';
import { requireId, requireInteger, requireIsoDate, requireEnum } from '../../../domain/src/validation.js';
import { validateAssemblyDefinition } from '../../../domain/src/assembly-definition.js';
import { fingerprint } from '../../../application/src/value-utils.js';
import { declarationPins, sqliteAssemblyLeaves, writeAssemblyAsset, writeAssemblyProposal } from '../sqlite/sqlite-assembly-store.js';

const RECORD_KEYS = ['schemaVersion','contentKind','assetId','assetVersion','metadataVersion','name','kind','metadata','assembly','metadataFingerprint','contentFingerprint','findings','componentPins','frameBounds','lifecycle','createdRevision','createdAt','createdBy','proposal'];
const CONTENT_KEYS = ['assetId','name','kind','metadata','assembly','metadataFingerprint','contentFingerprint','findings','componentPins','frameBounds'];
const PROPOSAL_KEYS = ['schemaVersion','proposalId','proposalVersion','status','content','validated','proposerActorId','proposerActorKind','proposerTaskId','createdRevision','createdAt','updatedBy','feedback','previousProposalVersion','decision'];
const eq = (a,b,label) => invariant(fingerprint(a) === fingerprint(b), 'BUNDLE_ASSEMBLY_INVALID', label);
const exact = (value, keys, label) => {
  invariant(value && typeof value === 'object' && !Array.isArray(value), 'BUNDLE_ASSEMBLY_INVALID', `${label} must be an object.`);
  eq(Object.keys(value).sort(), [...keys].sort(), `${label} has unsupported or missing keys.`);
};
function ordered(records, identity, version) {
  return [...records].sort((a,b) => a[identity].localeCompare(b[identity]) || a[version] - b[version]);
}

export function portableAssemblyLibrary(database, projectId, portableAsset) {
  const versions = database.prepare('SELECT record_json FROM assembly_versions WHERE project_id=? ORDER BY asset_id,asset_version').all(projectId).map(row => JSON.parse(row.record_json));
  const proposals = database.prepare('SELECT record_json FROM assembly_proposal_versions WHERE project_id=? ORDER BY proposal_id,proposal_version').all(projectId).map(row => JSON.parse(row.record_json));
  if (!versions.length && !proposals.length) return null;
  const heads = database.prepare('SELECT asset_id,asset_version FROM assembly_heads WHERE project_id=? ORDER BY asset_id').all(projectId).map(row => ({ assetId: row.asset_id, assetVersion: row.asset_version }));
  const proposalHeads = database.prepare('SELECT proposal_id,proposal_version FROM assembly_proposal_heads WHERE project_id=? ORDER BY proposal_id').all(projectId).map(row => ({ proposalId: row.proposal_id, proposalVersion: row.proposal_version }));
  for (const head of proposalHeads) invariant(['ACCEPTED','DISCARDED'].includes(proposals.find(record => record.proposalId === head.proposalId && record.proposalVersion === head.proposalVersion)?.status), 'BUNDLE_NOT_QUIESCENT', 'Resolve Assembly proposals before portable export.');
  const leaves = new Map();
  for (const record of [...versions, ...proposals.map(proposal => ({ ...proposal.validated, createdRevision: proposal.createdRevision }))]) {
    for (const [key, leaf] of sqliteAssemblyLeaves(database, projectId, record.assembly, record.createdRevision)) leaves.set(key, portableAsset(leaf));
  }
  return { schemaVersion: 1, versions, heads, proposals, proposalHeads,
    leafAssets: ordered([...leaves.values()], 'assetId', 'assetVersion') };
}

export function validatePortableAssemblies(project, restoreAsset, validateLeafSchema) {
  const library = project.assemblyLibrary;
  exact(library, ['schemaVersion','versions','heads','proposals','proposalHeads','leafAssets'], 'assemblyLibrary');
  invariant(library.schemaVersion === 1, 'BUNDLE_ASSEMBLY_INVALID', 'Unsupported Assembly Library schema.');
  for (const key of ['versions','heads','proposals','proposalHeads','leafAssets']) invariant(Array.isArray(library[key]) && library[key].length <= 10000, 'BUNDLE_COUNT_LIMIT', `Assembly ${key} exceeds its bounded record count.`);
  invariant(library.versions.length + library.proposals.length > 0, 'BUNDLE_ASSEMBLY_INVALID', 'Schema v5 requires Assembly content or history.');
  const leafVersions = new Map(project.assetLibrary.versions.map(version => [`${version.assetId}@${version.assetVersion}:${version.metadataVersion}`, version]));
  const leaves = new Map();
  for (const leaf of library.leafAssets) {
    validateLeafSchema(leaf);
    const key = `${leaf.assetId}@${leaf.assetVersion}:${leaf.metadataVersion}`;
    invariant(!leaves.has(key), 'BUNDLE_ASSEMBLY_INVALID', 'Duplicate Assembly leaf closure record.');
    const version = leafVersions.get(key);
    invariant(version && leaf.sliceBinding.sliceId === version.sliceId && leaf.sliceBinding.sliceVersion === version.sliceVersion, 'BUNDLE_ASSEMBLY_INVALID', 'Assembly leaf pin lacks its immutable native version.');
    for (const field of ['name','kind','lifecycle','metadata','metadataFingerprint']) eq(leaf[field], version[field], `Assembly leaf ${field} differs from native history.`);
    const binding = project.assetLibrary.sliceBindings.find(candidate => candidate.sliceId === version.sliceId && candidate.sliceVersion === version.sliceVersion);
    for (const field of ['sourceDigest','artifactDigest','width','height','byteSize','rectangle','atlasId','sourceId','definitionVersion','definitionFingerprint','processorId','mediaType']) eq(leaf.sliceBinding[field], binding[field], `Assembly leaf binding ${field} differs.`);
    const findings = project.assetLibrary.findings.filter(item => item.assetId === version.assetId && item.assetVersion === version.assetVersion).sort((a,b) => a.findingOrder-b.findingOrder).map(item => item.finding);
    eq(leaf.findings, findings, 'Assembly leaf findings differ.');
    leaves.set(key, restoreAsset(leaf));
  }
  const usedLeaves = new Set();
  const validateContent = (content, cutoff) => {
    exact(content, CONTENT_KEYS, 'Assembly content');
    const selectedLeaves = new Map();
    for (const pin of declarationPins(content.assembly)) {
      const key = `${pin.assetId}@${pin.assetVersion}:${pin.metadataVersion}`;
      invariant(leaves.has(key) && leafVersions.get(key).createdRevision <= cutoff, 'BUNDLE_ASSEMBLY_INVALID', 'Assembly component is missing or newer than its containing record.');
      usedLeaves.add(key); selectedLeaves.set(key, leaves.get(key));
    }
    const actual = validateAssemblyDefinition({ ...content, assets: selectedLeaves, projectId: project.projectHead.projectId });
    eq(actual, content, 'Assembly content differs from validated exact components.');
    invariant(!actual.findings.some(finding => finding.severity === 'ERROR'), 'BUNDLE_ASSEMBLY_INVALID', 'Assembly content contains technical errors.');
  };
  const assetHeads = new Map(), proposalHeads = new Map();
  eq(library.versions, ordered(library.versions, 'assetId','assetVersion'), 'Assembly versions must be in canonical order.');
  eq(library.proposals, ordered(library.proposals, 'proposalId','proposalVersion'), 'Assembly proposals must be in canonical order.');
  eq(library.leafAssets, ordered(library.leafAssets, 'assetId','assetVersion'), 'Leaf closure must be in canonical order.');
  for (const proposal of library.proposals) {
    exact(proposal, PROPOSAL_KEYS, 'Assembly proposal');
    requireId(proposal.proposalId, 'proposalId'); requireInteger(proposal.proposalVersion, 'proposalVersion', { min: 1 });
    requireInteger(proposal.createdRevision, 'createdRevision', { min: 1, max: project.projectHead.revision }); requireIsoDate(proposal.createdAt, 'createdAt');
    requireEnum(proposal.proposerActorKind, 'proposerActorKind', ['human','agent']); requireId(proposal.proposerActorId, 'proposerActorId');
    if (proposal.proposerTaskId !== null) requireId(proposal.proposerTaskId, 'proposerTaskId');
    requireId(proposal.updatedBy, 'updatedBy');
    exact(proposal.content, ['assetId','operation','expectedAssetVersion','expectedMetadataVersion','name','kind','metadata','assembly'], 'Assembly proposal content');
    requireEnum(proposal.content.operation, 'operation', ['create','update']);
    requireInteger(proposal.content.expectedAssetVersion, 'expectedAssetVersion', { min: 0 }); requireInteger(proposal.content.expectedMetadataVersion, 'expectedMetadataVersion', { min: 0 });
    const previous = proposalHeads.get(proposal.proposalId);
    invariant(proposal.schemaVersion === 1 && proposal.proposalVersion === (previous?.proposalVersion ?? 0)+1 && proposal.previousProposalVersion === (previous?.proposalVersion ?? null), 'BUNDLE_ASSEMBLY_INVALID', 'Assembly proposal version lineage is invalid.');
    invariant(!previous ? proposal.status === 'PENDING' : previous.status === 'PENDING' ? ['ACCEPTED','DISCARDED','CHANGES_REQUESTED'].includes(proposal.status) : previous.status === 'CHANGES_REQUESTED' && proposal.status === 'PENDING', 'BUNDLE_ASSEMBLY_INVALID', 'Assembly proposal transition is invalid.');
    if (previous) {
      invariant(proposal.createdRevision > previous.createdRevision && proposal.proposerActorId === previous.proposerActorId && proposal.proposerTaskId === previous.proposerTaskId, 'BUNDLE_ASSEMBLY_INVALID', 'Proposal revision/proposer lineage differs.');
      if (previous.status === 'PENDING') { eq(proposal.content, previous.content, 'Owner resolution changed proposed content.'); eq(proposal.validated, previous.validated, 'Owner resolution changed validated content.'); }
    }
    invariant(proposal.feedback === null || typeof proposal.feedback === 'string' && proposal.feedback.trim().length > 0 && proposal.feedback.length <= 2000, 'BUNDLE_ASSEMBLY_INVALID', 'Invalid proposal feedback.');
    invariant(proposal.status !== 'CHANGES_REQUESTED' || proposal.feedback !== null, 'BUNDLE_ASSEMBLY_INVALID', 'Changes requested requires feedback.');
    eq(proposal.decision, { PENDING: null, ACCEPTED: 'ACCEPT', DISCARDED: 'DISCARD', CHANGES_REQUESTED: 'REQUEST_CHANGES' }[proposal.status], 'Proposal decision/status mismatch.');
    for (const field of ['assetId','name','kind','metadata','assembly']) eq(proposal.content[field], proposal.validated[field], 'Proposed and validated content differ.');
    if (proposal.status === 'PENDING') {
      const target = library.versions.filter(record => record.assetId === proposal.content.assetId && record.createdRevision < proposal.createdRevision).at(-1);
      invariant(proposal.content.expectedAssetVersion === (target?.assetVersion ?? 0) && proposal.content.expectedMetadataVersion === (target?.metadataVersion ?? 0) && proposal.content.operation === (target ? 'update' : 'create'), 'BUNDLE_ASSEMBLY_INVALID', 'Proposal target expectations disagree with its submission revision.');
    }
    validateContent(proposal.validated, proposal.createdRevision);
    proposalHeads.set(proposal.proposalId, proposal);
  }
  for (const record of library.versions) {
    exact(record, RECORD_KEYS, 'Assembly version');
    invariant(record.schemaVersion === 1 && record.contentKind === 'assembly' && record.lifecycle === 'DRAFT', 'BUNDLE_ASSEMBLY_INVALID', 'Unsupported Assembly record.');
    requireId(record.createdBy, 'createdBy'); requireIsoDate(record.createdAt, 'createdAt'); requireInteger(record.createdRevision, 'createdRevision', { min: 1, max: project.projectHead.revision });
    const prior = assetHeads.get(record.assetId);
    invariant(record.assetVersion === (prior?.assetVersion ?? 0)+1 && record.metadataVersion === (prior ? prior.metadataVersion + (record.metadataFingerprint === prior.metadataFingerprint ? 0 : 1) : 1), 'BUNDLE_ASSEMBLY_INVALID', 'Assembly version lineage is invalid.');
    invariant(!prior || record.createdRevision > prior.createdRevision, 'BUNDLE_ASSEMBLY_INVALID', 'Assembly revision history is not ordered.');
    invariant(!project.assetLibrary.versions.some(leaf => leaf.assetId === record.assetId) && !project.legacyAssets.some(leaf => leaf.assetId === record.assetId), 'BUNDLE_ASSEMBLY_INVALID', 'Assembly ID collides with native/legacy content.');
    if (record.proposal !== null) {
      exact(record.proposal, ['proposalId','proposalVersion'], 'Assembly proposal provenance');
      const proposal = library.proposals.find(value => value.proposalId === record.proposal.proposalId && value.proposalVersion === record.proposal.proposalVersion);
      invariant(proposal?.status === 'ACCEPTED' && proposal.createdRevision === record.createdRevision, 'BUNDLE_ASSEMBLY_INVALID', 'Saved Assembly lacks exact accepted proposal provenance.');
      eq(proposal.validated.contentFingerprint, record.contentFingerprint, 'Accepted proposal differs from saved Assembly.');
      invariant(proposal.content.expectedAssetVersion === (prior?.assetVersion ?? 0) && proposal.content.expectedMetadataVersion === (prior?.metadataVersion ?? 0) && proposal.content.operation === (prior ? 'update' : 'create'), 'BUNDLE_ASSEMBLY_INVALID', 'Accepted proposal target expectations differ from the saved prior version.');
    }
    validateContent(Object.fromEntries(CONTENT_KEYS.map(key => [key,record[key]])), record.createdRevision);
    assetHeads.set(record.assetId, record);
  }
  for (const proposal of library.proposals) {
    const applications = library.versions.filter(record => record.proposal?.proposalId === proposal.proposalId && record.proposal?.proposalVersion === proposal.proposalVersion);
    invariant(applications.length === (proposal.status === 'ACCEPTED' ? 1 : 0), 'BUNDLE_ASSEMBLY_INVALID', 'Every accepted Assembly proposal must have exactly one linked saved Assembly version.');
  }
  eq([...usedLeaves].sort(), [...leaves.keys()].sort(), 'Assembly leaf closure contains missing or unused records.');
  eq(library.heads, [...assetHeads.values()].map(asset => ({ assetId: asset.assetId, assetVersion: asset.assetVersion })), 'Assembly head projection mismatch.');
  eq(library.proposalHeads, [...proposalHeads.values()].map(proposal => ({ proposalId: proposal.proposalId, proposalVersion: proposal.proposalVersion })), 'Proposal head projection mismatch.');
  for (const proposal of proposalHeads.values()) invariant(['ACCEPTED','DISCARDED'].includes(proposal.status), 'BUNDLE_NOT_QUIESCENT', 'Portable Assembly proposals must be terminal.');
}

export function restoredAssemblySnapshot(library, revision) {
  const assets = new Map(), proposals = new Map();
  for (const asset of library.versions) if (asset.createdRevision <= revision) assets.set(asset.assetId, structuredClone(asset));
  for (const proposal of library.proposals) if (proposal.createdRevision <= revision) proposals.set(proposal.proposalId, structuredClone(proposal));
  return assets.size || proposals.size ? { schemaVersion: 1, assets: [...assets.values()], proposals: [...proposals.values()] } : null;
}

export function importAssemblyLibrary(database, project) {
  if (project.schemaVersion !== 5) return;
  for (const proposal of project.assemblyLibrary.proposals) writeAssemblyProposal(database, project.projectHead.projectId, proposal, 'bundle_import');
  for (const record of project.assemblyLibrary.versions) writeAssemblyAsset(database, project.projectHead.projectId, record, 'bundle_import');
}
