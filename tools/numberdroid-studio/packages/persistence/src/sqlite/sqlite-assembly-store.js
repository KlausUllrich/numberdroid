import { sqliteResolvedClip } from './sqlite-clip-store.js';
import { assemblyContentSlots } from '../../../domain/src/assembly-geometry.js';
import { invariant } from '../../../domain/src/errors.js';
import { validateAssemblyDefinition } from '../../../domain/src/assembly-definition.js';
import { fingerprint } from '../../../application/src/value-utils.js';

export function declarationPins(assembly) {
  if (assembly.schemaVersion === 2) return assemblyContentSlots(assembly);
  return assembly.components.flatMap(component => [
    { componentId: component.componentId, variantId: null, ...component.asset },
    ...component.variantOverrides.map(override => ({ componentId: component.componentId, variantId: override.variantId, ...override.asset })),
  ]);
}

export function sqliteAssemblyLeaves(database, projectId, assembly, cutoff) {
  const assets = new Map();
  for (const slot of assemblyContentSlots(assembly)) {
    if (slot.content.kind === 'none') continue;
    const pin = slot.content.asset;
    if (slot.content.kind === 'animation') {
      const clip = sqliteResolvedClip(database, projectId, pin, cutoff);
      assets.set(`${pin.assetId}@${pin.assetVersion}:${pin.metadataVersion}`, clip);
      continue;
    }
    const row = database.prepare(`SELECT v.*, b.artifact_digest, b.artifact_uri, b.media_type, b.width, b.height,
      b.byte_size, b.source_digest, b.rectangle_json, b.atlas_id, b.source_id, b.atlas_definition_version, b.atlas_definition_fingerprint, b.rectangle_id, b.processor_id, b.prior_digest, b.committed_revision FROM asset_versions v JOIN asset_slice_bindings b
      ON b.project_id=v.project_id AND b.slice_id=v.slice_id AND b.slice_version=v.slice_version
      WHERE v.project_id=? AND v.asset_id=? AND v.asset_version=?`).get(projectId, pin.assetId, pin.assetVersion);
    invariant(row && row.metadata_version === pin.metadataVersion && row.created_revision <= cutoff,
      'ASSEMBLY_COMPONENT_NOT_FOUND', 'The exact native component version is unavailable at this revision.', { pin });
    const revision = database.prepare('SELECT revision_json FROM revisions WHERE project_id=? AND revision_number=?').get(projectId, row.created_revision);
    const record = JSON.parse(revision.revision_json).snapshot.assetLibrary?.assets.find(asset => asset.assetId === pin.assetId && asset.assetVersion === pin.assetVersion);
    invariant(record && fingerprint(record.metadata) === fingerprint(JSON.parse(row.metadata_json)) && record.metadataVersion === pin.metadataVersion,
      'ASSEMBLY_COMPONENT_CORRUPT', 'Component metadata history and SQLite row disagree.', { pin });
    invariant(record.sliceBinding?.digest === row.artifact_digest && record.sliceBinding?.sourceDigest === row.source_digest
      && record.sliceBinding?.width === row.width && record.sliceBinding?.height === row.height,
    'ASSEMBLY_COMPONENT_CORRUPT', 'Component imagery lineage differs from its immutable binding.', { pin });
    const expectedBinding = { projectId, sliceId: row.slice_id, sliceVersion: row.slice_version, atlasId: row.atlas_id,
      sourceId: row.source_id, sourceDigest: row.source_digest, definitionVersion: row.atlas_definition_version,
      definitionFingerprint: row.atlas_definition_fingerprint, rectangleId: row.rectangle_id, rectangle: JSON.parse(row.rectangle_json),
      processorId: row.processor_id, digest: row.artifact_digest, artifactUri: row.artifact_uri, mediaType: row.media_type,
      byteSize: row.byte_size, width: row.width, height: row.height, priorDigest: row.prior_digest, committedRevision: row.committed_revision };
    invariant(fingerprint(record.sliceBinding) === fingerprint(expectedBinding), 'ASSEMBLY_COMPONENT_CORRUPT', 'Component full imagery binding differs from immutable SQLite lineage.', { pin });
    const artifact = database.prepare('SELECT * FROM artifacts WHERE digest=?').get(row.artifact_digest);
    const source = database.prepare('SELECT * FROM artifacts WHERE digest=?').get(row.source_digest);
    invariant(artifact?.state === 'LIVE' && source?.state === 'LIVE' && artifact.byte_size === row.byte_size
      && artifact.media_type === row.media_type && artifact.width === row.width && artifact.height === row.height,
    'ASSEMBLY_COMPONENT_CORRUPT', 'Component artifact metadata is missing or inconsistent.', { pin });
    assets.set(`${pin.assetId}@${pin.assetVersion}:${pin.metadataVersion}`, record);
  }
  return assets;
}

export function validateStoredAssemblyContent(database, projectId, record, cutoff) {
  const assets = sqliteAssemblyLeaves(database, projectId, record.assembly, cutoff);
  const validated = validateAssemblyDefinition({ ...record, assets, projectId });
  for (const key of ['metadata', 'assembly', 'metadataFingerprint', 'contentFingerprint', 'findings', 'componentPins', 'frameBounds']) {
    invariant(fingerprint(record[key]) === fingerprint(validated[key]), 'ASSEMBLY_RECORD_CORRUPT', `Assembly ${key} does not match its declaration and exact components.`, { assetId: record.assetId, field: key });
  }
  invariant(!validated.findings.some(finding => finding.severity === 'ERROR'), 'ASSEMBLY_INVALID', 'Assembly has unresolved technical errors.');
  return assets;
}

export function assemblyContentDigests(records) {
  return [...new Set([...records.values()].flatMap(record => record.contentKind === 'animation' ? record.frameBindings.map(frame => frame.sliceBinding.digest) : [record.sliceBinding.digest]))].sort();
}
export function storedAssemblyPins(database, projectId, identity, version, assembly, proposal = false) {
  const prefix = proposal ? 'assembly_proposal' : 'assembly';
  const idColumn = proposal ? 'proposal_id' : 'asset_id', versionColumn = proposal ? 'proposal_version' : 'asset_version';
  if (assembly.schemaVersion === 2) {
    invariant(!database.prepare(`SELECT 1 FROM ${prefix}_component_pins WHERE project_id=? AND ${idColumn}=? AND ${versionColumn}=?`).get(projectId, identity, version), 'ASSEMBLY_RECORD_CORRUPT', 'Assembly v2 cannot also carry legacy pin rows.');
    return database.prepare(`SELECT * FROM ${prefix}_content_pins WHERE project_id=? AND ${idColumn}=? AND ${versionColumn}=? ORDER BY pin_order`).all(projectId, identity, version).map((row, index) => {
      invariant(row.pin_order === index, 'ASSEMBLY_RECORD_CORRUPT', 'Assembly content pin order must be contiguous.');
      return {
        componentId: row.component_id, slotKind: row.slot_kind, slotId: row.slot_id,
        content: row.content_kind === 'none' ? { kind: 'none' } : { kind: row.content_kind, asset: {
          assetId: row.content_kind === 'image' ? row.image_asset_id : row.clip_asset_id,
          assetVersion: row.content_kind === 'image' ? row.image_asset_version : row.clip_asset_version,
          metadataVersion: row.target_metadata_version,
        } },
      };
    });
  }
  if (Number(database.prepare('PRAGMA user_version').get().user_version) >= 17) invariant(!database.prepare(`SELECT 1 FROM ${prefix}_content_pins WHERE project_id=? AND ${idColumn}=? AND ${versionColumn}=?`).get(projectId, identity, version), 'ASSEMBLY_RECORD_CORRUPT', 'Assembly v1 cannot carry v2 content pin rows.');
  return database.prepare(`SELECT component_id,variant_id,leaf_asset_id,leaf_asset_version,leaf_metadata_version FROM ${prefix}_component_pins WHERE project_id=? AND ${idColumn}=? AND ${versionColumn}=? ORDER BY pin_order`).all(projectId, identity, version)
    .map(pin => ({ componentId: pin.component_id, variantId: pin.variant_id, assetId: pin.leaf_asset_id, assetVersion: pin.leaf_asset_version, metadataVersion: pin.leaf_metadata_version }));
}
function writePins(database, projectId, record, proposal = false) {
  const prefix = proposal ? 'assembly_proposal' : 'assembly';
  const identity = proposal ? ['proposal_id', 'proposal_version', record.proposalId, record.proposalVersion] : ['asset_id', 'asset_version', record.assetId, record.assetVersion];
  const assembly = proposal ? record.validated.assembly : record.assembly;
  if (assembly.schemaVersion === 2) {
    for (const [order, slot] of declarationPins(assembly).entries()) {
      const content = slot.content, pin = content.asset;
      database.prepare(`INSERT INTO ${prefix}_content_pins (project_id,${identity[0]},${identity[1]},pin_order,component_id,slot_kind,slot_id,content_kind,image_asset_id,image_asset_version,clip_asset_id,clip_asset_version,target_metadata_version)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(projectId, identity[2], identity[3], order, slot.componentId, slot.slotKind, slot.slotId, content.kind,
          content.kind === 'image' ? pin.assetId : null, content.kind === 'image' ? pin.assetVersion : null,
          content.kind === 'animation' ? pin.assetId : null, content.kind === 'animation' ? pin.assetVersion : null, pin?.metadataVersion ?? null);
    }
    return;
  }
  for (const [order, pin] of declarationPins(assembly).entries()) database.prepare(`INSERT INTO ${prefix}_component_pins
    (project_id,${identity[0]},${identity[1]},pin_order,component_id,variant_id,leaf_asset_id,leaf_asset_version,leaf_metadata_version)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(projectId, identity[2], identity[3], order, pin.componentId, pin.variantId, pin.assetId, pin.assetVersion, pin.metadataVersion);
}

export function writeAssemblyProposal(database, projectId, proposal, provenance = 'native_revision') {
  validateStoredAssemblyContent(database, projectId, proposal.validated, proposal.createdRevision);
  database.prepare(`INSERT INTO assembly_proposal_versions VALUES (?,?,?,?,?,?,?,?,?)`).run(projectId,
    proposal.proposalId, proposal.proposalVersion, proposal.previousProposalVersion, proposal.status, proposal.createdRevision,
    JSON.stringify(proposal), fingerprint(proposal), provenance);
  writePins(database, projectId, proposal, true);
  database.prepare(`INSERT INTO assembly_proposal_heads VALUES (?,?,?) ON CONFLICT(project_id,proposal_id)
    DO UPDATE SET proposal_version=excluded.proposal_version`).run(projectId, proposal.proposalId, proposal.proposalVersion);
}

export function writeAssemblyAsset(database, projectId, record, provenance = 'native_revision', fault = () => {}) {
  const leaves = validateStoredAssemblyContent(database, projectId, record, record.createdRevision);
  const prior = database.prepare('SELECT v.* FROM assembly_heads h JOIN assembly_versions v USING(project_id,asset_id,asset_version) WHERE h.project_id=? AND h.asset_id=?').get(projectId, record.assetId);
  invariant(record.assetVersion === (prior?.asset_version ?? 0) + 1, 'ASSEMBLY_VERSION_CONFLICT', 'Assembly versions must be consecutive.');
  const previous = prior ? JSON.parse(prior.record_json) : null;
  invariant(record.metadataVersion === (previous ? previous.metadataVersion + (previous.metadataFingerprint === record.metadataFingerprint ? 0 : 1) : 1), 'ASSEMBLY_VERSION_CONFLICT', 'Assembly metadata version is inconsistent.');
  if (!prior) {
    invariant(!database.prepare('SELECT 1 FROM asset_versions WHERE project_id=? AND asset_id=? UNION SELECT 1 FROM task_branch_processing_result_adoptions WHERE project_id=? AND asset_id=?').get(projectId, record.assetId, projectId, record.assetId),
      'ASSEMBLY_ID_CONFLICT', 'Choose a new Assembly ID; this ID already belongs to native or processing-result content.', { assetId: record.assetId });
    database.prepare('INSERT INTO assembly_identities VALUES (?,?,?)').run(projectId, record.assetId, record.createdRevision);
  }
  fault('after_assembly_identity');
  database.prepare('INSERT INTO assembly_versions VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(projectId, record.assetId,
    record.assetVersion, record.metadataVersion, prior?.asset_version ?? null, record.createdRevision,
    record.proposal?.proposalId ?? null, record.proposal?.proposalVersion ?? null, JSON.stringify(record), fingerprint(record), provenance);
  fault('after_assembly_version');
  writePins(database, projectId, record);
  fault('after_assembly_pins');
  for (const [order, finding] of record.findings.entries()) database.prepare('INSERT INTO assembly_version_findings VALUES (?,?,?,?,?)').run(projectId, record.assetId, record.assetVersion, order, JSON.stringify(finding));
  fault('after_assembly_findings');
  for (const digest of assemblyContentDigests(leaves)) database.prepare('INSERT OR IGNORE INTO artifact_references(project_id,owner_kind,owner_id,digest,created_revision) VALUES (?,?,?,?,?)').run(projectId, 'assembly_version', `${record.assetId}.v${record.assetVersion}`, digest, record.createdRevision);
  fault('after_assembly_references');
  database.prepare('INSERT INTO assembly_heads VALUES (?,?,?) ON CONFLICT(project_id,asset_id) DO UPDATE SET asset_version=excluded.asset_version').run(projectId, record.assetId, record.assetVersion);
  database.prepare('DELETE FROM assembly_head_tags WHERE project_id=? AND asset_id=?').run(projectId, record.assetId);
  for (const [order, tag] of record.metadata.tags.entries()) database.prepare('INSERT INTO assembly_head_tags VALUES (?,?,?,?)').run(projectId, record.assetId, tag, order);
  fault('after_assembly_head');
}

export function writeAssemblyRevision(database, projectId, revision, fault) {
  if (!revision.command.type.startsWith('assembly.')) {
    const prior = database.prepare('SELECT revision_json FROM revisions WHERE project_id=? AND revision_number=?').get(projectId, revision.number - 1);
    const before = prior ? JSON.parse(prior.revision_json).snapshot.assemblyLibrary ?? null : null;
    invariant(fingerprint(before) === fingerprint(revision.snapshot.assemblyLibrary ?? null), 'ASSEMBLY_REVISION_UNSUPPORTED', 'This operation would replace Assembly history. Preserve it or use the supported Assembly commands.');
    return;
  }
  const library = revision.snapshot.assemblyLibrary;
  invariant(library, 'INVALID_REVISION', 'Assembly revision is missing its Library.');
  if (revision.result.proposalId) {
    const proposal = library.proposals.find(proposal => proposal.proposalId === revision.result.proposalId);
    invariant(proposal && proposal.proposalVersion === revision.result.proposalVersion && proposal.createdRevision === revision.number, 'INVALID_REVISION', 'Assembly proposal result differs.');
    writeAssemblyProposal(database, projectId, proposal);
    fault('after_assembly_proposal');
  }
  if (revision.result.assetId) {
    const record = library.assets.find(asset => asset.assetId === revision.result.assetId);
    invariant(record && record.assetVersion === revision.result.assetVersion && record.createdRevision === revision.number, 'INVALID_REVISION', 'Assembly save result differs.');
    writeAssemblyAsset(database, projectId, record, 'native_revision', fault);
  }
}

export function rebuildAssemblyHeads(database, projectId) {
  if (Number(database.prepare('PRAGMA user_version').get().user_version) < 16) return;
  database.prepare('DELETE FROM assembly_head_tags WHERE project_id=?').run(projectId);
  database.prepare('DELETE FROM assembly_heads WHERE project_id=?').run(projectId);
  database.prepare('DELETE FROM assembly_proposal_heads WHERE project_id=?').run(projectId);
  const heads = new Map();
  for (const row of database.prepare('SELECT record_json FROM assembly_versions WHERE project_id=? ORDER BY asset_id,asset_version').all(projectId)) { const record=JSON.parse(row.record_json);heads.set(record.assetId,record); }
  for (const asset of heads.values()) {
    database.prepare('INSERT INTO assembly_heads VALUES (?,?,?)').run(projectId,asset.assetId,asset.assetVersion);
    for (const [order,tag] of asset.metadata.tags.entries()) database.prepare('INSERT INTO assembly_head_tags VALUES (?,?,?,?)').run(projectId,asset.assetId,tag,order);
  }
  database.prepare('INSERT INTO assembly_proposal_heads SELECT project_id,proposal_id,max(proposal_version) FROM assembly_proposal_versions WHERE project_id=? GROUP BY project_id,proposal_id').run(projectId);
}
