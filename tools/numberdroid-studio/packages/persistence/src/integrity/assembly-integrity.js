import { invariant } from '../../../domain/src/errors.js';
import { fingerprint } from '../../../application/src/value-utils.js';
import { applyAssemblyCommand } from '../../../application/src/assembly-service.js';
import { declarationPins, validateStoredAssemblyContent, storedAssemblyPins, assemblyContentDigests } from '../sqlite/sqlite-assembly-store.js';

const eq = (left, right, message) => invariant(fingerprint(left) === fingerprint(right), 'ASSEMBLY_INTEGRITY_MISMATCH', message);
export function inspectAssemblyIntegrity(database) {
  const findings = [];
  let versionCount = 0, proposalVersionCount = 0;
  for (const project of database.prepare('SELECT project_id,head_snapshot_json FROM projects').all()) {
    try {
      const projectId = project.project_id;
      const headSnapshot = JSON.parse(project.head_snapshot_json);
      const versions = database.prepare('SELECT * FROM assembly_versions WHERE project_id=? ORDER BY asset_id,asset_version').all(projectId);
      const proposals = database.prepare('SELECT * FROM assembly_proposal_versions WHERE project_id=? ORDER BY proposal_id,proposal_version').all(projectId);
      versionCount += versions.length; proposalVersionCount += proposals.length;
      const headAssets = new Map(), headProposals = new Map();
      const revisionRows = database.prepare('SELECT revision_number,command_type,revision_json FROM revisions WHERE project_id=? ORDER BY revision_number').all(projectId);
      const revisions = revisionRows.map(row => JSON.parse(row.revision_json));
      const nativeCreationRevisions = new Set();
      for (const row of [...versions, ...proposals].filter(value => value.provenance === 'native_revision')) {
        const creation = revisionRows.find(value => value.revision_number === row.created_revision);
        const revision = creation && JSON.parse(creation.revision_json);
        const expectedType = Object.hasOwn(row, 'asset_id')
          ? row.proposal_id === null ? 'assembly.save' : 'assembly.proposal.resolve'
          : row.status === 'PENDING' ? 'assembly.proposal.submit' : 'assembly.proposal.resolve';
        invariant(creation && revision.number === creation.revision_number && creation.command_type === expectedType
          && revision.command?.type === creation.command_type, 'ASSEMBLY_INTEGRITY_MISMATCH', 'Native Assembly row creation requires its matching SQL and JSON command type.');
        nativeCreationRevisions.add(row.created_revision);
      }
      for (const row of [...versions, ...proposals]) {
        if (row.provenance !== 'bundle_import') continue;
        const revision=revisions.find(value=>value.number===row.created_revision);
        invariant(database.prepare('SELECT 1 FROM bundle_imports WHERE project_id=? AND imported_revision>=?').get(projectId,row.created_revision)
          && revision?.command.commandId===`bundle-import.command.${row.created_revision}`
          && revision.command.fingerprint===fingerprint({provenance:'bundle_import',revision:row.created_revision}), 'ASSEMBLY_INTEGRITY_MISMATCH', 'Imported Assembly provenance lacks its reserved non-authorizing import revision.');
      }
      for (const row of versions) {
        const record = JSON.parse(row.record_json);
        eq(fingerprint(record), row.record_fingerprint, 'Assembly record hash mismatch.');
        invariant(record.schemaVersion === 1 && record.contentKind === 'assembly' && record.lifecycle === 'DRAFT'
          && record.assetId === row.asset_id && record.assetVersion === row.asset_version && record.metadataVersion === row.metadata_version
          && record.createdRevision === row.created_revision, 'ASSEMBLY_INTEGRITY_MISMATCH', 'Assembly version identity mismatch.');
        const exactLeaves = validateStoredAssemblyContent(database, projectId, record, row.created_revision);
        const created = revisions.find(revision => revision.number === row.created_revision);
        eq(created?.snapshot.assemblyLibrary?.assets.find(asset => asset.assetId === record.assetId && asset.assetVersion === record.assetVersion), record, 'Assembly row differs from its creation snapshot.');
        const expectedDigests = assemblyContentDigests(exactLeaves);
        eq(expectedDigests, database.prepare("SELECT digest FROM artifact_references WHERE project_id=? AND owner_kind='assembly_version' AND owner_id=? ORDER BY digest").all(projectId, `${record.assetId}.v${record.assetVersion}`).map(value => value.digest), 'Assembly imagery references differ from component closure.');
        const prior = headAssets.get(record.assetId);
        invariant(record.assetVersion === (prior?.assetVersion ?? 0) + 1
          && record.metadataVersion === (prior ? prior.metadataVersion + (prior.metadataFingerprint === record.metadataFingerprint ? 0 : 1) : 1), 'ASSEMBLY_INTEGRITY_MISMATCH', 'Assembly version sequence mismatch.');
        const pins = storedAssemblyPins(database, projectId, record.assetId, record.assetVersion, record.assembly);
        eq(pins, declarationPins(record.assembly), 'Assembly pin closure mismatch.');
        const savedFindings = database.prepare('SELECT finding_json FROM assembly_version_findings WHERE project_id=? AND asset_id=? AND asset_version=? ORDER BY finding_order').all(projectId, record.assetId, record.assetVersion).map(value => JSON.parse(value.finding_json));
        eq(savedFindings, record.findings, 'Assembly findings mismatch.');
        eq(record.proposal, row.proposal_id === null ? null : {proposalId:row.proposal_id,proposalVersion:row.proposal_version}, 'Assembly proposal FK differs from record provenance.');
        if (record.proposal) {
          const proposalRow = proposals.find(proposal => proposal.proposal_id === record.proposal.proposalId && proposal.proposal_version === record.proposal.proposalVersion);
          const proposal = proposalRow && JSON.parse(proposalRow.record_json);
          invariant(proposal?.status === 'ACCEPTED' && proposal.createdRevision === record.createdRevision,
            'ASSEMBLY_INTEGRITY_MISMATCH', 'Assembly acceptance provenance mismatch.');
          eq(proposal.validated.contentFingerprint, record.contentFingerprint, 'Accepted proposal content differs from the saved Assembly.');
        }
        headAssets.set(record.assetId, record);
      }
      for (const row of proposals) {
        const record = JSON.parse(row.record_json);
        eq(fingerprint(record), row.record_fingerprint, 'Assembly proposal hash mismatch.');
        invariant(record.proposalId === row.proposal_id && record.proposalVersion === row.proposal_version && record.status === row.status
          && record.createdRevision === row.created_revision, 'ASSEMBLY_INTEGRITY_MISMATCH', 'Assembly proposal identity mismatch.');
        validateStoredAssemblyContent(database, projectId, record.validated, row.created_revision);
        eq(revisions.find(revision => revision.number === row.created_revision)?.snapshot.assemblyLibrary?.proposals.find(proposal => proposal.proposalId === record.proposalId && proposal.proposalVersion === record.proposalVersion), record, 'Proposal row differs from its creation snapshot.');
        const prior = headProposals.get(record.proposalId);
        invariant(record.proposalVersion === (prior?.proposalVersion ?? 0) + 1 && record.previousProposalVersion === (prior?.proposalVersion ?? null), 'ASSEMBLY_INTEGRITY_MISMATCH', 'Assembly proposal versions are not consecutive.');
        invariant(!prior ? record.status === 'PENDING' : prior.status === 'PENDING'
          ? ['CHANGES_REQUESTED', 'ACCEPTED', 'DISCARDED'].includes(record.status)
          : prior.status === 'CHANGES_REQUESTED' && record.status === 'PENDING', 'ASSEMBLY_INTEGRITY_MISMATCH', 'Invalid Assembly proposal transition.');
        if (prior) {
          invariant(record.proposerActorId === prior.proposerActorId && record.proposerTaskId === prior.proposerTaskId, 'ASSEMBLY_INTEGRITY_MISMATCH', 'Assembly proposer identity changed.');
          if (prior.status === 'PENDING') eq(record.validated, prior.validated, 'Owner resolution modified the proposed content.');
        }
        invariant(record.status !== 'CHANGES_REQUESTED' || typeof record.feedback === 'string' && record.feedback.trim().length > 0, 'ASSEMBLY_INTEGRITY_MISMATCH', 'Changes requested requires feedback.');
        const pins = storedAssemblyPins(database, projectId, record.proposalId, record.proposalVersion, record.validated.assembly, true);
        eq(pins, declarationPins(record.validated.assembly), 'Proposal pin closure mismatch.');
        const applications = versions.filter(version => version.proposal_id === record.proposalId && version.proposal_version === record.proposalVersion);
        invariant(applications.length === (record.status === 'ACCEPTED' ? 1 : 0), 'ASSEMBLY_INTEGRITY_MISMATCH', 'Every accepted Assembly proposal must create exactly one linked Assembly version.');
        headProposals.set(record.proposalId, record);
      }
      for (const identity of database.prepare('SELECT asset_id,created_revision FROM assembly_identities WHERE project_id=?').all(projectId)) invariant(versions.find(row=>row.asset_id===identity.asset_id && row.asset_version===1)?.created_revision===identity.created_revision, 'ASSEMBLY_INTEGRITY_MISMATCH', 'Assembly reservation creation revision mismatch.');
      eq([...headAssets.keys()].sort(), database.prepare('SELECT asset_id FROM assembly_identities WHERE project_id=? ORDER BY asset_id').all(projectId).map(row => row.asset_id), 'Assembly identity reservations differ from version history.');
      eq([...headAssets.values()].map(asset => [asset.assetId, asset.assetVersion]), database.prepare('SELECT asset_id,asset_version FROM assembly_heads WHERE project_id=? ORDER BY asset_id').all(projectId).map(row => [row.asset_id, row.asset_version]), 'Assembly heads mismatch.');
      eq([...headProposals.values()].map(proposal => [proposal.proposalId, proposal.proposalVersion]), database.prepare('SELECT proposal_id,proposal_version FROM assembly_proposal_heads WHERE project_id=? ORDER BY proposal_id').all(projectId).map(row => [row.proposal_id, row.proposal_version]), 'Assembly proposal heads mismatch.');
      const orderAssets = values => [...values].sort((a,b) => a.assetId.localeCompare(b.assetId));
      const orderProposals = values => [...values].sort((a,b) => a.proposalId.localeCompare(b.proposalId));
      eq(orderAssets(headAssets.values()), orderAssets(headSnapshot.assemblyLibrary?.assets ?? []), 'Assembly snapshot differs from saved heads.');
      eq(orderProposals(headProposals.values()), orderProposals(headSnapshot.assemblyLibrary?.proposals ?? []), 'Proposal snapshot differs from saved heads.');
      for (const asset of headAssets.values()) {
        eq(asset.metadata.tags, database.prepare('SELECT tag FROM assembly_head_tags WHERE project_id=? AND asset_id=? ORDER BY tag_order').all(projectId, asset.assetId).map(row => row.tag), 'Assembly tag projection mismatch.');
        invariant(!(headSnapshot.assets ?? []).some(leaf => (leaf.id ?? leaf.assetId) === asset.assetId)
          && !database.prepare('SELECT 1 FROM asset_versions WHERE project_id=? AND asset_id=? UNION SELECT 1 FROM task_branch_processing_result_adoptions WHERE project_id=? AND asset_id=?').get(projectId, asset.assetId, projectId, asset.assetId), 'ASSEMBLY_INTEGRITY_MISMATCH', 'Assembly identity collides with another Asset.');
      }
      for (const revision of revisions.filter(value => nativeCreationRevisions.has(value.number) || value.command.type.startsWith('assembly.'))) {
        const persisted = [...versions, ...proposals].filter(row => row.created_revision === revision.number);
        if (persisted.length && persisted.every(row => row.provenance === 'bundle_import')) continue;
        invariant(persisted.length > 0 && revision.command.payload, 'ASSEMBLY_INTEGRITY_MISMATCH', 'Native Assembly command lacks exact persisted provenance.');
        const previous = revisions.find(value => value.number === revision.number - 1);
        invariant(previous, 'ASSEMBLY_INTEGRITY_MISMATCH', 'Assembly command lost its base revision.');
        if (revision.command.type !== 'assembly.proposal.submit') invariant(revision.command.actor.kind === 'human' && revision.command.actor.id === previous.snapshot.project.ownerId, 'ASSEMBLY_INTEGRITY_MISMATCH', 'Only the owner may save or resolve Assembly content.');
        const command = { ...revision.command, projectId, baseRevision: previous.number };
        const next = applyAssemblyCommand(command, structuredClone(previous.snapshot), { projectId, revisions: revisions.filter(value => value.number <= previous.number) }, revision.committedAt);
        eq(next.snapshot.assemblyLibrary, revision.snapshot.assemblyLibrary, 'Native Assembly revision differs from its semantic command.');
        eq(next.result, revision.result, 'Native Assembly result differs from its semantic command.');
      }
    } catch (error) { findings.push({ projectId: project.project_id, code: error.code ?? 'ASSEMBLY_INTEGRITY_FAILED', message: error.message }); }
  }
  return { ok: findings.length === 0, versionCount, proposalVersionCount, findings };
}
