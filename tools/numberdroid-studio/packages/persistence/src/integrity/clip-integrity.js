import { assertReviewSavedRecord } from '../sqlite/sqlite-review-store.js';
import { invariant } from '../../../domain/src/errors.js';
import { fingerprint } from '../../../application/src/value-utils.js';
import { applyClipCommand } from '../../../application/src/clip-service.js';
import { declarationClipPins, storedClipPins, clipContentDigests, validateStoredClipContent } from '../sqlite/sqlite-clip-store.js';

const eq = (left, right, message) => invariant(fingerprint(left) === fingerprint(right), 'CLIP_INTEGRITY_MISMATCH', message);
export function inspectClipIntegrity(database) {
  const findings = [];
  let versionCount = 0, proposalVersionCount = 0;
  for (const project of database.prepare('SELECT project_id,head_snapshot_json FROM projects').all()) {
    try {
      const projectId = project.project_id;
      const headSnapshot = JSON.parse(project.head_snapshot_json);
      const versions = database.prepare('SELECT * FROM clip_versions WHERE project_id=? ORDER BY asset_id,asset_version').all(projectId);
      const proposals = database.prepare('SELECT * FROM clip_proposal_versions WHERE project_id=? ORDER BY proposal_id,proposal_version').all(projectId);
      versionCount += versions.length; proposalVersionCount += proposals.length;
      const headAssets = new Map(), headProposals = new Map();
      const revisionRows = database.prepare('SELECT revision_number,command_type,revision_json FROM revisions WHERE project_id=? ORDER BY revision_number').all(projectId);
      const revisions = revisionRows.map(row => JSON.parse(row.revision_json));
      const nativeCreationRevisions = new Set();
      for (const row of [...versions, ...proposals].filter(value => value.provenance === 'native_revision')) {
        const creation = revisionRows.find(value => value.revision_number === row.created_revision);
        const revision = creation && JSON.parse(creation.revision_json);
        const isReview = Object.hasOwn(row, 'asset_id') && JSON.parse(row.record_json).review;
        const expectedType = Object.hasOwn(row, 'asset_id')
          ? isReview ? 'review.accept' : row.proposal_id === null ? 'clip.save' : 'clip.proposal.resolve'
          : row.status === 'PENDING' ? 'clip.proposal.submit' : 'clip.proposal.resolve';
        invariant(creation && revision.number === creation.revision_number && creation.command_type === expectedType
          && revision.command?.type === creation.command_type, 'CLIP_INTEGRITY_MISMATCH', 'Native Clip row creation requires its matching SQL and JSON command type.');
        nativeCreationRevisions.add(row.created_revision);
      }
      for (const row of [...versions, ...proposals]) {
        if (row.provenance !== 'bundle_import') continue;
        const revision=revisions.find(value=>value.number===row.created_revision);
        invariant(database.prepare('SELECT 1 FROM bundle_imports WHERE project_id=? AND imported_revision>=?').get(projectId,row.created_revision)
          && revision?.command.commandId===`bundle-import.command.${row.created_revision}`
          && revision.command.fingerprint===fingerprint({provenance:'bundle_import',revision:row.created_revision}), 'CLIP_INTEGRITY_MISMATCH', 'Imported Clip provenance lacks its reserved non-authorizing import revision.');
      }
      for (const row of versions) {
        const record = JSON.parse(row.record_json);
        eq(fingerprint(record), row.record_fingerprint, 'Clip record hash mismatch.');
        invariant(record.schemaVersion === 1 && record.contentKind === 'animation' && record.lifecycle === 'DRAFT'
          && record.assetId === row.asset_id && record.assetVersion === row.asset_version && record.metadataVersion === row.metadata_version
          && record.createdRevision === row.created_revision, 'CLIP_INTEGRITY_MISMATCH', 'Clip version identity mismatch.');
        if (record.review) assertReviewSavedRecord(database, projectId, 'animation', record, row.created_revision);
        const exactLeaves = validateStoredClipContent(database, projectId, record, row.created_revision);
        const created = revisions.find(revision => revision.number === row.created_revision);
        eq(created?.snapshot.clipLibrary?.assets.find(asset => asset.assetId === record.assetId && asset.assetVersion === record.assetVersion), record, 'Clip row differs from its creation snapshot.');
        const expectedDigests = clipContentDigests(exactLeaves);
        eq(expectedDigests, database.prepare("SELECT digest FROM artifact_references WHERE project_id=? AND owner_kind='clip_version' AND owner_id=? ORDER BY digest").all(projectId, `${record.assetId}.v${record.assetVersion}`).map(value => value.digest), 'Clip imagery references differ from component closure.');
        const prior = headAssets.get(record.assetId);
        invariant(record.assetVersion === (prior?.assetVersion ?? 0) + 1
          && record.metadataVersion === (prior ? prior.metadataVersion + (prior.metadataFingerprint === record.metadataFingerprint ? 0 : 1) : 1), 'CLIP_INTEGRITY_MISMATCH', 'Clip version sequence mismatch.');
        const pins = storedClipPins(database,projectId,record.assetId,record.assetVersion);
        eq(pins, declarationClipPins(record.clip), 'Clip pin closure mismatch.');
        const savedFindings = database.prepare('SELECT finding_json FROM clip_version_findings WHERE project_id=? AND asset_id=? AND asset_version=? ORDER BY finding_order').all(projectId, record.assetId, record.assetVersion).map(value => JSON.parse(value.finding_json));
        eq(savedFindings, record.findings, 'Clip findings mismatch.');
        eq(record.proposal, row.proposal_id === null ? null : {proposalId:row.proposal_id,proposalVersion:row.proposal_version}, 'Clip proposal FK differs from record provenance.');
        if (record.proposal) {
          const proposalRow = proposals.find(proposal => proposal.proposal_id === record.proposal.proposalId && proposal.proposal_version === record.proposal.proposalVersion);
          const proposal = proposalRow && JSON.parse(proposalRow.record_json);
          invariant(proposal?.status === 'ACCEPTED' && proposal.createdRevision === record.createdRevision,
            'CLIP_INTEGRITY_MISMATCH', 'Clip acceptance provenance mismatch.');
          eq(proposal.validated.contentFingerprint, record.contentFingerprint, 'Accepted proposal content differs from the saved Clip.');
        }
        headAssets.set(record.assetId, record);
      }
      for (const row of proposals) {
        const record = JSON.parse(row.record_json);
        eq(fingerprint(record), row.record_fingerprint, 'Clip proposal hash mismatch.');
        invariant(record.proposalId === row.proposal_id && record.proposalVersion === row.proposal_version && record.status === row.status
          && record.createdRevision === row.created_revision, 'CLIP_INTEGRITY_MISMATCH', 'Clip proposal identity mismatch.');
        validateStoredClipContent(database, projectId, record.validated, row.created_revision);
        eq(revisions.find(revision => revision.number === row.created_revision)?.snapshot.clipLibrary?.proposals.find(proposal => proposal.proposalId === record.proposalId && proposal.proposalVersion === record.proposalVersion), record, 'Proposal row differs from its creation snapshot.');
        const prior = headProposals.get(record.proposalId);
        invariant(record.proposalVersion === (prior?.proposalVersion ?? 0) + 1 && record.previousProposalVersion === (prior?.proposalVersion ?? null), 'CLIP_INTEGRITY_MISMATCH', 'Clip proposal versions are not consecutive.');
        invariant(!prior ? record.status === 'PENDING' : prior.status === 'PENDING'
          ? ['CHANGES_REQUESTED', 'ACCEPTED', 'DISCARDED'].includes(record.status)
          : prior.status === 'CHANGES_REQUESTED' && record.status === 'PENDING', 'CLIP_INTEGRITY_MISMATCH', 'Invalid Clip proposal transition.');
        if (prior) {
          invariant(record.proposerActorId === prior.proposerActorId && record.proposerActorKind === prior.proposerActorKind && record.proposerTaskId === prior.proposerTaskId, 'CLIP_INTEGRITY_MISMATCH', 'Clip proposer identity changed.');
          if (prior.status === 'PENDING') eq(record.validated, prior.validated, 'Owner resolution modified the proposed content.');
        }
        invariant(record.status !== 'CHANGES_REQUESTED' || typeof record.feedback === 'string' && record.feedback.trim().length > 0, 'CLIP_INTEGRITY_MISMATCH', 'Changes requested requires feedback.');
        const pins = storedClipPins(database,projectId,record.proposalId,record.proposalVersion,true);
        eq(pins, declarationClipPins(record.validated.clip), 'Proposal pin closure mismatch.');
        const applications = versions.filter(version => version.proposal_id === record.proposalId && version.proposal_version === record.proposalVersion);
        invariant(applications.length === (record.status === 'ACCEPTED' ? 1 : 0), 'CLIP_INTEGRITY_MISMATCH', 'Every accepted Clip proposal must create exactly one linked Clip version.');
        headProposals.set(record.proposalId, record);
      }
      for (const identity of database.prepare('SELECT asset_id,created_revision FROM clip_identities WHERE project_id=?').all(projectId)) invariant(versions.find(row=>row.asset_id===identity.asset_id && row.asset_version===1)?.created_revision===identity.created_revision, 'CLIP_INTEGRITY_MISMATCH', 'Clip reservation creation revision mismatch.');
      eq([...headAssets.keys()].sort(), database.prepare('SELECT asset_id FROM clip_identities WHERE project_id=? ORDER BY asset_id').all(projectId).map(row => row.asset_id), 'Clip identity reservations differ from version history.');
      eq([...headAssets.values()].map(asset => [asset.assetId, asset.assetVersion]), database.prepare('SELECT asset_id,asset_version FROM clip_heads WHERE project_id=? ORDER BY asset_id').all(projectId).map(row => [row.asset_id, row.asset_version]), 'Clip heads mismatch.');
      eq([...headProposals.values()].map(proposal => [proposal.proposalId, proposal.proposalVersion]), database.prepare('SELECT proposal_id,proposal_version FROM clip_proposal_heads WHERE project_id=? ORDER BY proposal_id').all(projectId).map(row => [row.proposal_id, row.proposal_version]), 'Clip proposal heads mismatch.');
      const orderAssets = values => [...values].sort((a,b) => a.assetId.localeCompare(b.assetId));
      const orderProposals = values => [...values].sort((a,b) => a.proposalId.localeCompare(b.proposalId));
      eq(orderAssets(headAssets.values()), orderAssets(headSnapshot.clipLibrary?.assets ?? []), 'Clip snapshot differs from saved heads.');
      eq(orderProposals(headProposals.values()), orderProposals(headSnapshot.clipLibrary?.proposals ?? []), 'Proposal snapshot differs from saved heads.');
      for (const asset of headAssets.values()) {
        eq(asset.metadata.tags, database.prepare('SELECT tag FROM clip_head_tags WHERE project_id=? AND asset_id=? ORDER BY tag_order').all(projectId, asset.assetId).map(row => row.tag), 'Clip tag projection mismatch.');
        invariant(!(headSnapshot.assets ?? []).some(leaf => (leaf.id ?? leaf.assetId) === asset.assetId)
          && !database.prepare('SELECT 1 FROM asset_versions WHERE project_id=? AND asset_id=? UNION SELECT 1 FROM task_branch_processing_result_adoptions WHERE project_id=? AND asset_id=? UNION SELECT 1 FROM assembly_identities WHERE project_id=? AND asset_id=?').get(projectId, asset.assetId, projectId, asset.assetId, projectId, asset.assetId), 'CLIP_INTEGRITY_MISMATCH', 'Clip identity collides with another Asset.');
      }
      for (const revision of revisions.filter(value => nativeCreationRevisions.has(value.number) || value.command.type.startsWith('clip.'))) {
        const persisted = [...versions, ...proposals].filter(row => row.created_revision === revision.number);
        if (persisted.length && persisted.every(row => row.provenance === 'bundle_import')) continue;
        if (revision.command.type === 'review.accept') continue; // Shared Review integrity replays the complete mixed transaction.
        invariant(persisted.length > 0 && revision.command.payload, 'CLIP_INTEGRITY_MISMATCH', 'Native Clip command lacks exact persisted provenance.');
        const previous = revisions.find(value => value.number === revision.number - 1);
        invariant(previous, 'CLIP_INTEGRITY_MISMATCH', 'Clip command lost its base revision.');
        if (revision.command.type !== 'clip.proposal.submit') invariant(revision.command.actor.kind === 'human' && revision.command.actor.id === previous.snapshot.project.ownerId, 'CLIP_INTEGRITY_MISMATCH', 'Only the owner may save or resolve Clip content.');
        const command = { ...revision.command, projectId, baseRevision: previous.number };
        const next = applyClipCommand(command, structuredClone(previous.snapshot), { projectId, revisions: revisions.filter(value => value.number <= previous.number) }, revision.committedAt);
        eq(next.snapshot.clipLibrary, revision.snapshot.clipLibrary, 'Native Clip revision differs from its semantic command.');
        eq(next.result, revision.result, 'Native Clip result differs from its semantic command.');
      }
    } catch (error) { findings.push({ projectId: project.project_id, code: error.code ?? 'CLIP_INTEGRITY_FAILED', message: error.message }); }
  }
  return { ok: findings.length === 0, versionCount, proposalVersionCount, findings };
}
