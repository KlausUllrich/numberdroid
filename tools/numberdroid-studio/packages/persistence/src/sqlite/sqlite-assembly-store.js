import { invariant } from '../../../domain/src/errors.js';
import { validateAssemblyDefinition } from '../../../domain/src/assembly-definition.js';
import { fingerprint } from '../../../application/src/value-utils.js';

export function declarationPins(assembly) {
  return assembly.components.flatMap(component => [
    { componentId: component.componentId, variantId: null, ...component.asset },
    ...component.variantOverrides.map(override => ({ componentId: component.componentId, variantId: override.variantId, ...override.asset })),
  ]);
}

export function sqliteAssemblyLeaves(database, projectId, assembly, cutoff) {
  const assets = new Map();
  for (const pin of declarationPins(assembly)) {
    const row = database.prepare(`SELECT v.*, b.artifact_digest, b.artifact_uri, b.media_type, b.width, b.height,
      b.byte_size, b.source_digest FROM asset_versions v JOIN asset_slice_bindings b
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

function writePins(database, projectId, record, proposal = false) {
  const table = proposal ? 'assembly_proposal_component_pins' : 'assembly_component_pins';
  const identity = proposal ? ['proposal_id', 'proposal_version', record.proposalId, record.proposalVersion] : ['asset_id', 'asset_version', record.assetId, record.assetVersion];
  const assembly = proposal ? record.validated.assembly : record.assembly;
  for (const [order, pin] of declarationPins(assembly).entries()) database.prepare(`INSERT INTO ${table}
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
  if (!prior) database.prepare('INSERT INTO assembly_identities VALUES (?,?,?)').run(projectId, record.assetId, record.createdRevision);
  fault('after_assembly_identity');
  database.prepare('INSERT INTO assembly_versions VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(projectId, record.assetId,
    record.assetVersion, record.metadataVersion, prior?.asset_version ?? null, record.createdRevision,
    record.proposal?.proposalId ?? null, record.proposal?.proposalVersion ?? null, JSON.stringify(record), fingerprint(record), provenance);
  fault('after_assembly_version');
  writePins(database, projectId, record);
  fault('after_assembly_pins');
  for (const [order, finding] of record.findings.entries()) database.prepare('INSERT INTO assembly_version_findings VALUES (?,?,?,?,?)').run(projectId, record.assetId, record.assetVersion, order, JSON.stringify(finding));
  fault('after_assembly_findings');
  for (const leaf of leaves.values()) database.prepare('INSERT OR IGNORE INTO artifact_references(project_id,owner_kind,owner_id,digest,created_revision) VALUES (?,?,?,?,?)').run(projectId, 'assembly_version', `${record.assetId}.v${record.assetVersion}`, leaf.sliceBinding.digest, record.createdRevision);
  fault('after_assembly_references');
  database.prepare('INSERT INTO assembly_heads VALUES (?,?,?) ON CONFLICT(project_id,asset_id) DO UPDATE SET asset_version=excluded.asset_version').run(projectId, record.assetId, record.assetVersion);
  database.prepare('DELETE FROM assembly_head_tags WHERE project_id=? AND asset_id=?').run(projectId, record.assetId);
  for (const [order, tag] of record.metadata.tags.entries()) database.prepare('INSERT INTO assembly_head_tags VALUES (?,?,?,?)').run(projectId, record.assetId, tag, order);
  fault('after_assembly_head');
}

export function writeAssemblyRevision(database, projectId, revision, fault) {
  if (!revision.command.type.startsWith('assembly.')) return;
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
