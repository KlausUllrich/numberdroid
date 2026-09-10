import { invariant } from '../../../domain/src/errors.js';
import { requireId, requireInteger, requireIsoDate, requireEnum } from '../../../domain/src/validation.js';
import { validateClipDefinition } from '../../../domain/src/clip-definition.js';
import { fingerprint } from '../../../application/src/value-utils.js';
import { declarationClipPins, sqliteClipSlices, writeClipAsset, writeClipProposal } from '../sqlite/sqlite-clip-store.js';

const RECORD_KEYS = ['schemaVersion','contentKind','assetId','assetVersion','metadataVersion','name','kind','metadata','clip','metadataFingerprint','contentFingerprint','findings','framePins','frameBounds','lifecycle','createdRevision','createdAt','createdBy','proposal'];
const CONTENT_KEYS = ['assetId','name','kind','metadata','clip','metadataFingerprint','contentFingerprint','findings','framePins','frameBounds'];
const PROPOSAL_KEYS = ['schemaVersion','proposalId','proposalVersion','status','content','validated','proposerActorId','proposerActorKind','proposerTaskId','createdRevision','createdAt','updatedBy','feedback','previousProposalVersion','decision'];
const eq = (a,b,label) => invariant(fingerprint(a) === fingerprint(b), 'BUNDLE_CLIP_INVALID', label);
const exact = (value, keys, label) => {
  invariant(value && typeof value === 'object' && !Array.isArray(value), 'BUNDLE_CLIP_INVALID', `${label} must be an object.`);
  eq(Object.keys(value).sort(), [...keys].sort(), `${label} has unsupported or missing keys.`);
};
function ordered(records, identity, version) {
  return [...records].sort((a,b) => a[identity].localeCompare(b[identity]) || a[version] - b[version]);
}

export function portableClipLibrary(database, projectId, portableBinding) {
  const versions = database.prepare('SELECT record_json FROM clip_versions WHERE project_id=? ORDER BY asset_id,asset_version').all(projectId).map(row => JSON.parse(row.record_json));
  const proposals = database.prepare('SELECT record_json FROM clip_proposal_versions WHERE project_id=? ORDER BY proposal_id,proposal_version').all(projectId).map(row => JSON.parse(row.record_json));
  if (!versions.length && !proposals.length) return null;
  const heads = database.prepare('SELECT asset_id,asset_version FROM clip_heads WHERE project_id=? ORDER BY asset_id').all(projectId).map(row => ({ assetId: row.asset_id, assetVersion: row.asset_version }));
  const proposalHeads = database.prepare('SELECT proposal_id,proposal_version FROM clip_proposal_heads WHERE project_id=? ORDER BY proposal_id').all(projectId).map(row => ({ proposalId: row.proposal_id, proposalVersion: row.proposal_version }));
  for (const head of proposalHeads) invariant(['ACCEPTED','DISCARDED'].includes(proposals.find(record => record.proposalId === head.proposalId && record.proposalVersion === head.proposalVersion)?.status), 'BUNDLE_NOT_QUIESCENT', 'Resolve Clip proposals before portable export.');
  const slices = new Map();
  for (const record of [...versions, ...proposals.map(proposal => ({ ...proposal.validated, createdRevision: proposal.createdRevision }))]) {
    for (const [key, binding] of sqliteClipSlices(database, projectId, record.clip, record.createdRevision)) slices.set(key, portableBinding(binding));
  }
  return { schemaVersion: 1, versions, heads, proposals, proposalHeads,
    sliceBindings: [...slices.values()].sort((a,b)=>a.sliceId.localeCompare(b.sliceId)||a.sliceVersion-b.sliceVersion) };
}

export function validatePortableClips(project, restoreBinding, validateBindingSchema) {
  const library = project.clipLibrary;
  exact(library, ['schemaVersion','versions','heads','proposals','proposalHeads','sliceBindings'], 'clipLibrary');
  invariant(library.schemaVersion === 1, 'BUNDLE_CLIP_INVALID', 'Unsupported Animation Library schema.');
  for(const key of ['versions','heads','proposals','proposalHeads','sliceBindings'])invariant(Array.isArray(library[key])&&library[key].length<=10000,'BUNDLE_COUNT_LIMIT',`Clip ${key} exceeds its bounded record count.`);
  invariant(library.versions.length+library.proposals.length>0,'BUNDLE_CLIP_INVALID','A clipLibrary requires content or history.');
  const bindings=new Map(project.assetLibrary.sliceBindings.map(binding=>[`${binding.sliceId}@${binding.sliceVersion}`,binding]));
  const slices=new Map();
  for(const binding of library.sliceBindings){validateBindingSchema(binding);const key=`${binding.sliceId}@${binding.sliceVersion}`;invariant(!slices.has(key),'BUNDLE_CLIP_INVALID','Duplicate cut closure binding.');const persisted=bindings.get(key);invariant(persisted,'BUNDLE_CLIP_INVALID','Clip frame lacks immutable cut history.');for(const field of ['sourceId','sourceDigest','artifactDigest','width','height','byteSize','rectangleId','rectangle','atlasId','definitionVersion','definitionFingerprint','processorId','mediaType','priorDigest','committedRevision'])eq(binding[field],persisted[field],`Clip cut ${field} differs from immutable binding.`);invariant(binding.projectId===project.projectHead.projectId,'BUNDLE_CLIP_INVALID','Cut belongs to another project.');slices.set(key,restoreBinding(binding));}
  const usedSlices=new Set();
  const validateContent=(content,cutoff)=>{
    exact(content,CONTENT_KEYS,'Clip content');const selected=new Map();
    for(const pin of declarationClipPins(content.clip)){const key=`${pin.sliceId}@${pin.sliceVersion}`;invariant(slices.has(key)&&slices.get(key).committedRevision<=cutoff,'BUNDLE_CLIP_INVALID','Clip frame is missing or newer than its containing record.');usedSlices.add(key);selected.set(key,slices.get(key));}
    const actual=validateClipDefinition({...content,slices:selected,projectId:project.projectHead.projectId});eq(actual,content,'Clip content differs from validated exact frames.');invariant(!actual.findings.some(finding=>finding.severity==='ERROR'),'BUNDLE_CLIP_INVALID','Clip contains technical errors.');
  };
  const assetHeads = new Map(), proposalHeads = new Map();
  eq(library.versions, ordered(library.versions, 'assetId','assetVersion'), 'Clip versions must be in canonical order.');
  eq(library.proposals, ordered(library.proposals, 'proposalId','proposalVersion'), 'Clip proposals must be in canonical order.');
  eq(library.sliceBindings,[...library.sliceBindings].sort((a,b)=>a.sliceId.localeCompare(b.sliceId)||a.sliceVersion-b.sliceVersion),'Cut closure must be in canonical order.');
  for (const proposal of library.proposals) {
    exact(proposal, PROPOSAL_KEYS, 'Clip proposal');
    requireId(proposal.proposalId, 'proposalId'); requireInteger(proposal.proposalVersion, 'proposalVersion', { min: 1 });
    requireInteger(proposal.createdRevision, 'createdRevision', { min: 1, max: project.projectHead.revision }); requireIsoDate(proposal.createdAt, 'createdAt');
    requireEnum(proposal.proposerActorKind, 'proposerActorKind', ['human','agent']); requireId(proposal.proposerActorId, 'proposerActorId');
    if (proposal.proposerTaskId !== null) requireId(proposal.proposerTaskId, 'proposerTaskId');
    requireId(proposal.updatedBy, 'updatedBy');
    exact(proposal.content, ['assetId','operation','expectedAssetVersion','expectedMetadataVersion','name','kind','metadata','clip'], 'Clip proposal content');
    requireEnum(proposal.content.operation, 'operation', ['create','update']);
    requireInteger(proposal.content.expectedAssetVersion, 'expectedAssetVersion', { min: 0 }); requireInteger(proposal.content.expectedMetadataVersion, 'expectedMetadataVersion', { min: 0 });
    const previous = proposalHeads.get(proposal.proposalId);
    invariant(proposal.schemaVersion === 1 && proposal.proposalVersion === (previous?.proposalVersion ?? 0)+1 && proposal.previousProposalVersion === (previous?.proposalVersion ?? null), 'BUNDLE_CLIP_INVALID', 'Clip proposal version lineage is invalid.');
    invariant(!previous ? proposal.status === 'PENDING' : previous.status === 'PENDING' ? ['ACCEPTED','DISCARDED','CHANGES_REQUESTED'].includes(proposal.status) : previous.status === 'CHANGES_REQUESTED' && proposal.status === 'PENDING', 'BUNDLE_CLIP_INVALID', 'Clip proposal transition is invalid.');
    if (previous) {
      invariant(proposal.createdRevision > previous.createdRevision && proposal.proposerActorId === previous.proposerActorId && proposal.proposerActorKind === previous.proposerActorKind && proposal.proposerTaskId === previous.proposerTaskId, 'BUNDLE_CLIP_INVALID', 'Proposal revision/proposer lineage differs.');
      if (previous.status === 'PENDING') { eq(proposal.content, previous.content, 'Owner resolution changed proposed content.'); eq(proposal.validated, previous.validated, 'Owner resolution changed validated content.'); }
    }
    invariant(proposal.feedback === null || typeof proposal.feedback === 'string' && proposal.feedback.trim().length > 0 && proposal.feedback.length <= 2000, 'BUNDLE_CLIP_INVALID', 'Invalid proposal feedback.');
    invariant(proposal.status !== 'CHANGES_REQUESTED' || proposal.feedback !== null, 'BUNDLE_CLIP_INVALID', 'Changes requested requires feedback.');
    eq(proposal.decision, { PENDING: null, ACCEPTED: 'ACCEPT', DISCARDED: 'DISCARD', CHANGES_REQUESTED: 'REQUEST_CHANGES' }[proposal.status], 'Proposal decision/status mismatch.');
    for (const field of ['assetId','name','kind','metadata','clip']) eq(proposal.content[field], proposal.validated[field], 'Proposed and validated content differ.');
    if (proposal.status === 'PENDING') {
      const target = library.versions.filter(record => record.assetId === proposal.content.assetId && record.createdRevision < proposal.createdRevision).at(-1);
      invariant(proposal.content.expectedAssetVersion === (target?.assetVersion ?? 0) && proposal.content.expectedMetadataVersion === (target?.metadataVersion ?? 0) && proposal.content.operation === (target ? 'update' : 'create'), 'BUNDLE_CLIP_INVALID', 'Proposal target expectations disagree with its submission revision.');
    }
    validateContent(proposal.validated, proposal.createdRevision);
    proposalHeads.set(proposal.proposalId, proposal);
  }
  for (const record of library.versions) {
    exact(record, RECORD_KEYS, 'Clip version');
    invariant(record.schemaVersion === 1 && record.contentKind === 'animation' && record.lifecycle === 'DRAFT', 'BUNDLE_CLIP_INVALID', 'Unsupported Clip record.');
    requireId(record.createdBy, 'createdBy'); requireIsoDate(record.createdAt, 'createdAt'); requireInteger(record.createdRevision, 'createdRevision', { min: 1, max: project.projectHead.revision });
    const prior = assetHeads.get(record.assetId);
    invariant(record.assetVersion === (prior?.assetVersion ?? 0)+1 && record.metadataVersion === (prior ? prior.metadataVersion + (record.metadataFingerprint === prior.metadataFingerprint ? 0 : 1) : 1), 'BUNDLE_CLIP_INVALID', 'Clip version lineage is invalid.');
    invariant(!prior || record.createdRevision > prior.createdRevision, 'BUNDLE_CLIP_INVALID', 'Clip revision history is not ordered.');
    invariant(!project.assetLibrary.versions.some(leaf => leaf.assetId === record.assetId) && !project.legacyAssets.some(leaf => leaf.assetId === record.assetId) && !(project.assemblyLibrary?.versions??[]).some(asset=>asset.assetId===record.assetId), 'BUNDLE_CLIP_INVALID', 'Clip ID collides with native/legacy content.');
    if (record.proposal !== null) {
      exact(record.proposal, ['proposalId','proposalVersion'], 'Clip proposal provenance');
      const proposal = library.proposals.find(value => value.proposalId === record.proposal.proposalId && value.proposalVersion === record.proposal.proposalVersion);
      invariant(proposal?.status === 'ACCEPTED' && proposal.createdRevision === record.createdRevision, 'BUNDLE_CLIP_INVALID', 'Saved Clip lacks exact accepted proposal provenance.');
      eq(proposal.validated.contentFingerprint, record.contentFingerprint, 'Accepted proposal differs from saved Clip.');
      invariant(proposal.content.expectedAssetVersion === (prior?.assetVersion ?? 0) && proposal.content.expectedMetadataVersion === (prior?.metadataVersion ?? 0) && proposal.content.operation === (prior ? 'update' : 'create'), 'BUNDLE_CLIP_INVALID', 'Accepted proposal target expectations differ from the saved prior version.');
    }
    validateContent(Object.fromEntries(CONTENT_KEYS.map(key => [key,record[key]])), record.createdRevision);
    assetHeads.set(record.assetId, record);
  }
  for (const proposal of library.proposals) {
    const applications = library.versions.filter(record => record.proposal?.proposalId === proposal.proposalId && record.proposal?.proposalVersion === proposal.proposalVersion);
    invariant(applications.length === (proposal.status === 'ACCEPTED' ? 1 : 0), 'BUNDLE_CLIP_INVALID', 'Every accepted Clip proposal must have exactly one linked saved Clip version.');
  }
  eq([...usedSlices].sort(), [...slices.keys()].sort(), 'Clip cut closure contains missing or unused records.');
  eq(library.heads, [...assetHeads.values()].map(asset => ({ assetId: asset.assetId, assetVersion: asset.assetVersion })), 'Clip head projection mismatch.');
  eq(library.proposalHeads, [...proposalHeads.values()].map(proposal => ({ proposalId: proposal.proposalId, proposalVersion: proposal.proposalVersion })), 'Proposal head projection mismatch.');
  for (const proposal of proposalHeads.values()) invariant(['ACCEPTED','DISCARDED'].includes(proposal.status), 'BUNDLE_NOT_QUIESCENT', 'Portable Clip proposals must be terminal.');
}

export function restoredClipSnapshot(library, revision) {
  const assets = new Map(), proposals = new Map();
  for (const asset of library.versions) if (asset.createdRevision <= revision) assets.set(asset.assetId, structuredClone(asset));
  for (const proposal of library.proposals) if (proposal.createdRevision <= revision) proposals.set(proposal.proposalId, structuredClone(proposal));
  return assets.size || proposals.size ? { schemaVersion: 1, assets: [...assets.values()], proposals: [...proposals.values()] } : null;
}

export function importClipLibrary(database, project) {
  if (project.schemaVersion !== 6 || !project.clipLibrary) return;
  for (const proposal of project.clipLibrary.proposals) writeClipProposal(database, project.projectHead.projectId, proposal, 'bundle_import');
  for (const record of project.clipLibrary.versions) writeClipAsset(database, project.projectHead.projectId, record, 'bundle_import');
}

export function resolvePortableClip(project,pin,cutoff,restoreBinding){
 const record=project.clipLibrary?.versions.find(record=>record.assetId===pin.assetId&&record.assetVersion===pin.assetVersion&&record.metadataVersion===pin.metadataVersion&&record.createdRevision<=cutoff);
 invariant(record,'BUNDLE_CLIP_INVALID','The exact Animation version is unavailable.');
 return {...structuredClone(record),frameBindings:record.clip.frames.map(frame=>{const binding=project.clipLibrary.sliceBindings.find(binding=>binding.sliceId===frame.slice.sliceId&&binding.sliceVersion===frame.slice.sliceVersion);invariant(binding&&binding.committedRevision<=record.createdRevision,'BUNDLE_CLIP_INVALID','Animation frame closure is missing.');return {frameId:frame.frameId,sliceBinding:restoreBinding(binding)};})};
}
