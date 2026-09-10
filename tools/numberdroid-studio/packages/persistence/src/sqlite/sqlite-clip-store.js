import { invariant } from '../../../domain/src/errors.js';
import { validateClipDefinition } from '../../../domain/src/clip-definition.js';
import { resolveHistoricalSliceBinding } from '../../../application/src/exact-cut-history.js';
import { fingerprint } from '../../../application/src/value-utils.js';

export function declarationClipPins(clip) { return clip.frames.map(frame=>({frameId:frame.frameId,...frame.slice})); }
export function sqliteHistoricalSliceBinding(database, projectId, sliceId, sliceVersion, cutoff=Number.MAX_SAFE_INTEGER) {
 const row=database.prepare('SELECT * FROM asset_slice_bindings WHERE project_id=? AND slice_id=? AND slice_version=?').get(projectId,sliceId,sliceVersion);
 if(!row){
  const revisions=database.prepare('SELECT revision_json FROM revisions WHERE project_id=? AND revision_number<=? ORDER BY revision_number').all(projectId,cutoff).map(row=>JSON.parse(row.revision_json));
  const binding=resolveHistoricalSliceBinding({projectId,revisions},projectId,sliceId,sliceVersion,cutoff);
  const image=database.prepare('SELECT * FROM artifacts WHERE digest=?').get(binding.digest),source=database.prepare('SELECT * FROM artifacts WHERE digest=?').get(binding.sourceDigest);
  invariant(image?.state==='LIVE' && source?.state==='LIVE' && image.byte_size===binding.byteSize && image.media_type===binding.mediaType && image.width===binding.width && image.height===binding.height,'CLIP_SLICE_CORRUPT','Unbound cut image/source metadata is inconsistent.');
  return binding;
 }
 invariant(row.committed_revision<=cutoff,'CLIP_SLICE_NOT_FOUND','The exact saved cut version is unavailable at this revision.',{sliceId,sliceVersion});
 const expected={projectId,sliceId,sliceVersion,atlasId:row.atlas_id,sourceId:row.source_id,sourceDigest:row.source_digest,definitionVersion:row.atlas_definition_version,definitionFingerprint:row.atlas_definition_fingerprint,rectangleId:row.rectangle_id,rectangle:JSON.parse(row.rectangle_json),processorId:row.processor_id,digest:row.artifact_digest,artifactUri:row.artifact_uri,mediaType:row.media_type,byteSize:row.byte_size,width:row.width,height:row.height,priorDigest:row.prior_digest,committedRevision:row.committed_revision};
 const revision=database.prepare('SELECT revision_json FROM revisions WHERE project_id=? AND revision_number=?').get(projectId,row.committed_revision);
 invariant(revision,'CLIP_SLICE_CORRUPT','The cut creation revision is missing.');
 const actual=resolveHistoricalSliceBinding({projectId,revisions:[JSON.parse(revision.revision_json)]},projectId,sliceId,sliceVersion,cutoff);
 invariant(fingerprint(actual)===fingerprint(expected),'CLIP_SLICE_CORRUPT','The full cut lineage differs from its immutable binding.');
 const image=database.prepare('SELECT * FROM artifacts WHERE digest=?').get(row.artifact_digest),source=database.prepare('SELECT * FROM artifacts WHERE digest=?').get(row.source_digest);
 invariant(image?.state==='LIVE' && source?.state==='LIVE' && image.byte_size===row.byte_size && image.media_type===row.media_type && image.width===row.width && image.height===row.height,'CLIP_SLICE_CORRUPT','Cut image/source metadata is missing or inconsistent.');
 return expected;
}
export function sqliteClipSlices(database,projectId,clip,cutoff){return new Map(clip.frames.map(frame=>[`${frame.slice.sliceId}@${frame.slice.sliceVersion}`,sqliteHistoricalSliceBinding(database,projectId,frame.slice.sliceId,frame.slice.sliceVersion,cutoff)]));}
export function sqliteResolvedClip(database,projectId,pin,cutoff=Number.MAX_SAFE_INTEGER){
 const row=database.prepare('SELECT * FROM clip_versions WHERE project_id=? AND asset_id=? AND asset_version=?').get(projectId,pin.assetId,pin.assetVersion);
 invariant(row && row.metadata_version===pin.metadataVersion && row.created_revision<=cutoff,'CLIP_NOT_FOUND','The exact Animation version is unavailable at this revision.',{pin});
 const record=JSON.parse(row.record_json);invariant(fingerprint(record)===row.record_fingerprint,'CLIP_RECORD_CORRUPT','The saved Animation fingerprint differs.');
 const slices=validateStoredClipContent(database,projectId,record,row.created_revision);
 return {...record,frameBindings:record.clip.frames.map(frame=>({frameId:frame.frameId,sliceBinding:slices.get(`${frame.slice.sliceId}@${frame.slice.sliceVersion}`)}))};
}

export function validateStoredClipContent(database, projectId, record, cutoff) {
  const slices = sqliteClipSlices(database, projectId, record.clip, cutoff);
  const validated = validateClipDefinition({ ...record, slices, projectId });
  for (const key of ['metadata', 'clip', 'metadataFingerprint', 'contentFingerprint', 'findings', 'framePins', 'frameBounds']) {
    invariant(fingerprint(record[key]) === fingerprint(validated[key]), 'CLIP_RECORD_CORRUPT', `Clip ${key} does not match its declaration and exact components.`, { assetId: record.assetId, field: key });
  }
  invariant(!validated.findings.some(finding => finding.severity === 'ERROR'), 'CLIP_INVALID', 'Clip has unresolved technical errors.');
  return slices;
}

export function clipContentDigests(slices){return [...new Set([...slices.values()].flatMap(binding=>[binding.digest,binding.sourceDigest,...(binding.priorDigest?[binding.priorDigest]:[])]))].sort();}
export function storedClipPins(database,projectId,identity,version,proposal=false){
 const table=proposal?'clip_proposal_frame_pins':'clip_frame_pins',id=proposal?'proposal_id':'asset_id',v=proposal?'proposal_version':'asset_version';
 return database.prepare(`SELECT frame_id,slice_id,slice_version FROM ${table} WHERE project_id=? AND ${id}=? AND ${v}=? ORDER BY pin_order`).all(projectId,identity,version).map(row=>({frameId:row.frame_id,sliceId:row.slice_id,sliceVersion:row.slice_version}));
}
function writePins(database,projectId,record,proposal=false){
 const table=proposal?'clip_proposal_frame_pins':'clip_frame_pins',id=proposal?'proposal_id':'asset_id',v=proposal?'proposal_version':'asset_version';
 const clip=proposal?record.validated.clip:record.clip;
 for(const [order,pin] of declarationClipPins(clip).entries())database.prepare(`INSERT INTO ${table}(project_id,${id},${v},pin_order,frame_id,slice_id,slice_version) VALUES(?,?,?,?,?,?,?)`).run(projectId,proposal?record.proposalId:record.assetId,proposal?record.proposalVersion:record.assetVersion,order,pin.frameId,pin.sliceId,pin.sliceVersion);
}

export function writeClipProposal(database, projectId, proposal, provenance = 'native_revision') {
  validateStoredClipContent(database, projectId, proposal.validated, proposal.createdRevision);
  database.prepare(`INSERT INTO clip_proposal_versions VALUES (?,?,?,?,?,?,?,?,?)`).run(projectId,
    proposal.proposalId, proposal.proposalVersion, proposal.previousProposalVersion, proposal.status, proposal.createdRevision,
    JSON.stringify(proposal), fingerprint(proposal), provenance);
  writePins(database, projectId, proposal, true);
  database.prepare(`INSERT INTO clip_proposal_heads VALUES (?,?,?) ON CONFLICT(project_id,proposal_id)
    DO UPDATE SET proposal_version=excluded.proposal_version`).run(projectId, proposal.proposalId, proposal.proposalVersion);
}

export function writeClipAsset(database, projectId, record, provenance = 'native_revision', fault = () => {}) {
  const leaves = validateStoredClipContent(database, projectId, record, record.createdRevision);
  const prior = database.prepare('SELECT v.* FROM clip_heads h JOIN clip_versions v USING(project_id,asset_id,asset_version) WHERE h.project_id=? AND h.asset_id=?').get(projectId, record.assetId);
  invariant(record.assetVersion === (prior?.asset_version ?? 0) + 1, 'CLIP_VERSION_CONFLICT', 'Clip versions must be consecutive.');
  const previous = prior ? JSON.parse(prior.record_json) : null;
  invariant(record.metadataVersion === (previous ? previous.metadataVersion + (previous.metadataFingerprint === record.metadataFingerprint ? 0 : 1) : 1), 'CLIP_VERSION_CONFLICT', 'Clip metadata version is inconsistent.');
  if (!prior) {
    invariant(!database.prepare('SELECT 1 FROM asset_versions WHERE project_id=? AND asset_id=? UNION SELECT 1 FROM task_branch_processing_result_adoptions WHERE project_id=? AND asset_id=? UNION SELECT 1 FROM assembly_identities WHERE project_id=? AND asset_id=?').get(projectId, record.assetId, projectId, record.assetId, projectId, record.assetId),
      'CLIP_ID_CONFLICT', 'Choose a new Clip ID; this ID already belongs to native or processing-result content.', { assetId: record.assetId });
    database.prepare('INSERT INTO clip_identities VALUES (?,?,?)').run(projectId, record.assetId, record.createdRevision);
  }
  fault('after_clip_identity');
  database.prepare('INSERT INTO clip_versions VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(projectId, record.assetId,
    record.assetVersion, record.metadataVersion, prior?.asset_version ?? null, record.createdRevision,
    record.proposal?.proposalId ?? null, record.proposal?.proposalVersion ?? null, JSON.stringify(record), fingerprint(record), provenance);
  fault('after_clip_version');
  writePins(database, projectId, record);
  fault('after_clip_pins');
  for (const [order, finding] of record.findings.entries()) database.prepare('INSERT INTO clip_version_findings VALUES (?,?,?,?,?)').run(projectId, record.assetId, record.assetVersion, order, JSON.stringify(finding));
  fault('after_clip_findings');
  for (const digest of clipContentDigests(leaves)) database.prepare('INSERT OR IGNORE INTO artifact_references(project_id,owner_kind,owner_id,digest,created_revision) VALUES (?,?,?,?,?)').run(projectId, 'clip_version', `${record.assetId}.v${record.assetVersion}`, digest, record.createdRevision);
  fault('after_clip_references');
  database.prepare('INSERT INTO clip_heads VALUES (?,?,?) ON CONFLICT(project_id,asset_id) DO UPDATE SET asset_version=excluded.asset_version').run(projectId, record.assetId, record.assetVersion);
  database.prepare('DELETE FROM clip_head_tags WHERE project_id=? AND asset_id=?').run(projectId, record.assetId);
  for (const [order, tag] of record.metadata.tags.entries()) database.prepare('INSERT INTO clip_head_tags VALUES (?,?,?,?)').run(projectId, record.assetId, tag, order);
  fault('after_clip_head');
}

export function writeClipRevision(database, projectId, revision, fault) {
  if (!revision.command.type.startsWith('clip.')) {
    const prior = database.prepare('SELECT revision_json FROM revisions WHERE project_id=? AND revision_number=?').get(projectId, revision.number - 1);
    const before = prior ? JSON.parse(prior.revision_json).snapshot.clipLibrary ?? null : null;
    invariant(fingerprint(before) === fingerprint(revision.snapshot.clipLibrary ?? null), 'CLIP_REVISION_UNSUPPORTED', 'This operation would replace Clip history. Preserve it or use the supported Clip commands.');
    return;
  }
  const library = revision.snapshot.clipLibrary;
  invariant(library, 'INVALID_REVISION', 'Clip revision is missing its Library.');
  if (revision.result.proposalId) {
    const proposal = library.proposals.find(proposal => proposal.proposalId === revision.result.proposalId);
    invariant(proposal && proposal.proposalVersion === revision.result.proposalVersion && proposal.createdRevision === revision.number, 'INVALID_REVISION', 'Clip proposal result differs.');
    writeClipProposal(database, projectId, proposal);
    fault('after_clip_proposal');
  }
  if (revision.result.assetId) {
    const record = library.assets.find(asset => asset.assetId === revision.result.assetId);
    invariant(record && record.assetVersion === revision.result.assetVersion && record.createdRevision === revision.number, 'INVALID_REVISION', 'Clip save result differs.');
    writeClipAsset(database, projectId, record, 'native_revision', fault);
  }
}

export function rebuildClipHeads(database, projectId) {
  if (Number(database.prepare('PRAGMA user_version').get().user_version) < 17) return;
  database.prepare('DELETE FROM clip_head_tags WHERE project_id=?').run(projectId);
  database.prepare('DELETE FROM clip_heads WHERE project_id=?').run(projectId);
  database.prepare('DELETE FROM clip_proposal_heads WHERE project_id=?').run(projectId);
  const heads = new Map();
  for (const row of database.prepare('SELECT record_json FROM clip_versions WHERE project_id=? ORDER BY asset_id,asset_version').all(projectId)) { const record=JSON.parse(row.record_json);heads.set(record.assetId,record); }
  for (const asset of heads.values()) {
    database.prepare('INSERT INTO clip_heads VALUES (?,?,?)').run(projectId,asset.assetId,asset.assetVersion);
    for (const [order,tag] of asset.metadata.tags.entries()) database.prepare('INSERT INTO clip_head_tags VALUES (?,?,?,?)').run(projectId,asset.assetId,tag,order);
  }
  database.prepare('INSERT INTO clip_proposal_heads SELECT project_id,proposal_id,max(proposal_version) FROM clip_proposal_versions WHERE project_id=? GROUP BY project_id,proposal_id').run(projectId);
}
