import { invariant } from '../../../domain/src/errors.js';
import { legacyReviewId, normalizeLegacySource } from '../../../application/src/legacy-review.js';
import { fingerprint } from '../../../application/src/value-utils.js';
import { writeClipAsset, validateStoredClipContent, sqliteHistoricalSliceBinding, sqliteResolvedClip } from './sqlite-clip-store.js';
import { writeAssemblyAsset, sqliteAssemblyLeaves } from './sqlite-assembly-store.js';
import { assemblyContentSlots } from '../../../domain/src/assembly-geometry.js';
import { validateAssemblyDefinition } from '../../../domain/src/assembly-definition.js';
import { validateAssetMetadataForVisualFacts } from '../../../domain/src/asset-definition.js';

export const REVIEW_CONTENT_LIBRARIES = Object.freeze({ image: 'assetLibrary', animation: 'clipLibrary', assembly: 'assemblyLibrary' });
const eq = (a, b, message) => invariant(fingerprint(a) === fingerprint(b), 'REVIEW_REVISION_INVALID', message);

export function assertReviewAuthority(before, after, command, committedAt) {
  const withoutReadStatus = grants => grants.map(({ authorizationStatus: _status, ...grant }) => grant);
  const expected = structuredClone(before.grants ?? []);
  if (command.actor.kind === 'human') {
    invariant(command.actor.id === before.project.ownerId, 'REVIEW_AUTHORITY_INVALID', 'Review owner action has the wrong actor.');
  } else {
    invariant(command.actor.kind === 'agent' && command.type === 'review.proposal.submit' && command.taskId && command.grantId,
      'REVIEW_AUTHORITY_INVALID', 'Agents may only submit explicitly granted Review work.');
    const grant = expected.find(grant => grant.id === command.grantId);
    invariant(grant && grant.agentId === command.actor.id && grant.taskId === command.taskId && grant.branchId === command.branchId
      && grant.branchId === 'branch.main' && grant.revokedAt === null
      && (!grant.expiresAt || Date.parse(grant.expiresAt) > Date.parse(committedAt))
      && grant.scopes.includes('review.proposal.submit') && grant.objectScopes.some(scope => scope.kind === 'project' && scope.id === command.projectId),
    'REVIEW_AUTHORITY_INVALID', 'Review submission lacks its exact live project, actor, task and branch grant.');
    const count = command.payload.items?.length;
    invariant(Number.isInteger(count) && count >= 1 && count <= 64 && Number.isSafeInteger(grant.usage.commands)
      && grant.usage.commands + count <= grant.budget.maxCommands, 'REVIEW_AUTHORITY_INVALID', 'Review submission exceeds its item command budget.');
    grant.usage.commands += count;
  }
  eq(withoutReadStatus(expected), withoutReadStatus(after.grants ?? []), 'Review must charge each submitted remaining item once and preserve every other grant field.');
}

export function reviewAcceptanceTable(kind) {
  invariant(Object.hasOwn(REVIEW_CONTENT_LIBRARIES, kind), 'REVIEW_REVISION_INVALID', 'Unknown Review content kind.');
  return `review_${kind}_acceptances`;
}

export function assertReviewSavedRecord(database, projectId, kind, record, createdRevision) {
  const provenance = record?.review;
  invariant(provenance && record.proposal === null, 'REVIEW_RECORD_CORRUPT', 'Saved Review content lost its source provenance.');
  const link = database.prepare(`SELECT * FROM ${reviewAcceptanceTable(kind)} WHERE project_id=? AND review_id=? AND item_id=?`).get(projectId, provenance.reviewId, provenance.itemId);
  invariant(link && link.review_version === provenance.reviewVersion && link.asset_id === record.assetId
    && link.asset_version === record.assetVersion && link.metadata_version === record.metadataVersion && link.created_revision === createdRevision,
  'REVIEW_RECORD_CORRUPT', 'Review acceptance differs from the exact saved version.');
  const row = database.prepare('SELECT record_json FROM review_versions WHERE project_id=? AND review_id=? AND review_version=?').get(projectId, provenance.reviewId, provenance.reviewVersion);
  const group = row && JSON.parse(row.record_json), item = group?.items.find(value => value.itemId === provenance.itemId);
  invariant(item?.status === 'ACCEPTED' && item.contentKind === kind && item.accepted?.assetId === record.assetId
    && item.accepted.assetVersion === record.assetVersion && item.accepted.metadataVersion === record.metadataVersion
    && item.accepted.revision === createdRevision && item.accepted.reviewVersion === provenance.reviewVersion,
  'REVIEW_RECORD_CORRUPT', 'Saved content is missing its immutable Review item receipt.');
  return true;
}

export function writeReviewRevision(database, projectId, revision, fault, { writeImage, writeBinding }) {
  const previousRow = database.prepare('SELECT revision_json FROM revisions WHERE project_id=? AND revision_number=?').get(projectId, revision.number - 1);
  const previous = previousRow ? JSON.parse(previousRow.revision_json).snapshot : {};
  if (!revision.command.type.startsWith('review.')) {
    eq(previous.reviewLibrary ?? null, revision.snapshot.reviewLibrary ?? null, 'This operation cannot replace Review history.');
    for (const group of previous.reviewLibrary?.groups ?? []) if (group.legacySource) {
      const library = REVIEW_CONTENT_LIBRARIES[group.legacySource.contentKind];
      eq(previous[library]?.proposals.find(proposal => proposal.proposalId === group.legacySource.proposalId),
        revision.snapshot[library]?.proposals.find(proposal => proposal.proposalId === group.legacySource.proposalId), 'An adopted legacy proposal is immutable.');
    }
    return false;
  }
  const groups = revision.snapshot.reviewLibrary?.groups;
  const group = groups?.find(value => value.reviewId === revision.result.reviewId);
  const oldGroup = previous.reviewLibrary?.groups.find(value => value.reviewId === revision.result.reviewId);
  invariant(group && group.reviewVersion === revision.result.reviewVersion && group.createdRevision === revision.number
    && group.reviewVersion === (oldGroup?.reviewVersion ?? 0) + 1, 'REVIEW_REVISION_INVALID', 'Review result differs from its exact next immutable version.');
  assertReviewAuthority(previous, revision.snapshot, { ...revision.command, projectId }, revision.committedAt);
  if (oldGroup) {
    eq(group.legacySource ?? null, oldGroup.legacySource ?? null, 'Legacy source identity is immutable.');
    eq(group.legacyProvenance ?? null, oldGroup.legacyProvenance ?? null, 'Legacy source history is immutable.');
  }
  if (group.legacySource) {
    eq(group.legacySource, normalizeLegacySource(group.legacySource), 'Legacy source must have exact identity fields.');
    invariant(group.reviewId === legacyReviewId(projectId, group.legacySource), 'REVIEW_REVISION_INVALID', 'Legacy Review identity differs from its source.');
    invariant(!groups.some(other => other.reviewId !== group.reviewId && other.legacySource?.contentKind === group.legacySource.contentKind && other.legacySource.proposalId === group.legacySource.proposalId), 'REVIEW_REVISION_INVALID', 'A legacy proposal already has an authoritative Review.');
  }
  eq(groups.filter(value => value.reviewId !== group.reviewId), (previous.reviewLibrary?.groups ?? []).filter(value => value.reviewId !== group.reviewId), 'Only the addressed Review may change.');
  database.prepare('INSERT INTO review_versions VALUES (?,?,?,?,?,?,?,?,?)').run(projectId, group.reviewId, group.reviewVersion,
    group.previousReviewVersion, group.contentVersion, group.status, revision.number, JSON.stringify(group), fingerprint(group));
  fault('after_review_version');
  for (const [order, item] of group.items.entries()) database.prepare('INSERT INTO review_items VALUES (?,?,?,?,?,?,?,?)').run(
    projectId, group.reviewId, group.reviewVersion, item.itemId, order, item.contentKind, item.status, JSON.stringify(item));
  for (const item of group.items) for (const [order, id] of item.dependsOn.entries()) database.prepare('INSERT INTO review_dependencies VALUES (?,?,?,?,?,?)').run(
    projectId, group.reviewId, group.reviewVersion, item.itemId, id, order);
  fault('after_review_items');
  database.prepare('INSERT INTO review_events VALUES (?,?,?,?,?,?)').run(projectId, group.reviewId, group.reviewVersion, revision.command.type,
    group.feedback ? JSON.stringify(group.feedback) : null, group.decision ? JSON.stringify(group.decision) : null);
  fault('after_review_event');

  // Retain every reviewed source version, including work later discarded. The
  // typed leaf validators remain responsible for exact immutable lineage.
  for (const item of group.items) {
    const record = item.proposedRecord;
    const bindings = item.contentKind === 'image' ? [record.sliceBinding] : item.contentKind === 'animation'
      ? record.clip.frames.map(frame => frame.slice) : [];
    const exactBindings = bindings.map(binding => writeBinding(binding));
    const digests = new Set(exactBindings.flatMap(binding => [binding.digest, binding.sourceDigest, ...(binding.priorDigest ? [binding.priorDigest] : [])]));

    for (const digest of digests) database.prepare('INSERT OR IGNORE INTO artifact_references(project_id,owner_kind,owner_id,digest,created_revision) VALUES (?,?,?,?,?)').run(
      projectId, 'review_version', `${group.reviewId}.v${group.reviewVersion}`, digest, revision.number);
  }
  fault('after_review_references');
  const accepted = revision.result.accepted ?? [];
  invariant(revision.command.type === 'review.accept' || accepted.length === 0, 'REVIEW_REVISION_INVALID', 'Only acceptance may save Review content.');
  for (const [kind, libraryName] of Object.entries(REVIEW_CONTENT_LIBRARIES)) {
    const selected = accepted.filter(pin => pin.contentKind === kind);
    const expected = structuredClone(previous[libraryName] ?? { schemaVersion: 1, assets: [], proposals: [] });
    for (const pin of selected) {
      const item = group.items.find(item => item.itemId === pin.itemId);
      const record = revision.snapshot[libraryName]?.assets.find(asset => asset.assetId === pin.assetId);
      invariant(item?.status === 'ACCEPTED' && record && record.assetVersion === pin.assetVersion && record.metadataVersion === pin.metadataVersion
        && record.proposal === null, 'REVIEW_REVISION_INVALID', 'Review receipt does not identify its exact saved content.');
      eq(record.review, { reviewId: group.reviewId, reviewVersion: group.reviewVersion, itemId: item.itemId }, 'Saved content requires exact Review provenance.');
      const index = expected.assets.findIndex(asset => asset.assetId === record.assetId);
      if (index < 0) expected.assets.push(record); else expected.assets[index] = record;
      if (kind === 'image') writeImage(record);
      else if (kind === 'animation') writeClipAsset(database, projectId, record, 'native_revision', fault);
      else writeAssemblyAsset(database, projectId, record, 'native_revision', fault);
      fault(`after_review_${kind}_asset`);
      database.prepare(`INSERT INTO ${reviewAcceptanceTable(kind)} VALUES (?,?,?,?,?,?,?,?)`).run(projectId, group.reviewId, group.reviewVersion,
        item.itemId, pin.assetId, pin.assetVersion, pin.metadataVersion, revision.number);
      fault('after_review_acceptance');
    }
    eq(revision.snapshot[libraryName] ?? null, previous[libraryName] === undefined && selected.length === 0 ? null : expected,
      'Review may change only the typed versions identified by its acceptance receipt.');
  }
  database.prepare('INSERT INTO review_heads VALUES (?,?,?) ON CONFLICT(project_id,review_id) DO UPDATE SET review_version=excluded.review_version').run(projectId, group.reviewId, group.reviewVersion);
  fault('after_review_head');
  return true;
}

export function rebuildReviewHeads(database, projectId) {
  if (Number(database.prepare('PRAGMA user_version').get().user_version) < 18) return;
  database.prepare('DELETE FROM review_heads WHERE project_id=?').run(projectId);
  database.prepare('INSERT INTO review_heads SELECT project_id,review_id,max(review_version) FROM review_versions WHERE project_id=? GROUP BY project_id,review_id').run(projectId);
}

export function verifyReviewContent(database, projectId, group) {
  if (group.legacySource) {
    const source = normalizeLegacySource(group.legacySource), provenance = group.legacyProvenance;
    invariant(group.reviewId === legacyReviewId(projectId, source) && provenance, 'REVIEW_RECORD_CORRUPT', 'Legacy Review provenance is missing.');
    for (const [revisionNumber, expectedFingerprint, expectedVersion] of [[provenance.sourceRevision, provenance.sourceFingerprint, null], [provenance.viewedProposalRevision, provenance.viewedProposalFingerprint, source.expectedProposalVersion]]) {
      const row = database.prepare('SELECT revision_json FROM revisions WHERE project_id=? AND revision_number=?').get(projectId, revisionNumber);
      const proposal = row && JSON.parse(row.revision_json).snapshot[REVIEW_CONTENT_LIBRARIES[source.contentKind]]?.proposals.find(value => value.proposalId === source.proposalId);
      invariant(proposal && fingerprint(proposal) === expectedFingerprint && (expectedVersion === null || proposal.proposalVersion === expectedVersion), 'REVIEW_RECORD_CORRUPT', 'Legacy Review differs from its exact proposal history.');
    }
  }
  const stored = database.prepare('SELECT record_json,record_fingerprint FROM review_versions WHERE project_id=? AND review_id=? AND review_version=?').get(projectId, group.reviewId, group.reviewVersion);
  invariant(stored && stored.record_fingerprint === fingerprint(group) && fingerprint(JSON.parse(stored.record_json)) === fingerprint(group),
    'REVIEW_RECORD_CORRUPT', 'Review history differs from its immutable record.');
  const leaves = new Map(), digests = new Set();
  for (const item of group.items.filter(item => item.contentKind !== 'assembly')) {
    const record = item.proposedRecord;
    if (item.contentKind === 'image') {
      const actual = sqliteHistoricalSliceBinding(database, projectId, record.sliceBinding.sliceId, record.sliceBinding.sliceVersion, group.createdRevision);
      eq(actual, record.sliceBinding, 'Review image lineage differs from its exact saved cut.');
      for (const digest of [actual.digest, actual.sourceDigest, ...(actual.priorDigest ? [actual.priorDigest] : [])]) digests.add(digest);
      const validated = validateAssetMetadataForVisualFacts({ assetId: record.assetId, kind: record.kind, metadata: item.payload.metadata,
        pixelSize: { width: actual.width, height: actual.height }, pivot: actual.rectangle.pivot });
      eq(validated.metadata, record.metadata, 'Review image metadata differs from its authored content.');
      eq(validated.findings, record.findings, 'Review image findings differ from its authored content.');
      invariant(!record.findings.some(finding => finding.severity === 'ERROR'), 'REVIEW_RECORD_CORRUPT', 'Review image contains unresolved technical errors.');
      leaves.set(`${record.assetId}@${record.assetVersion}:${record.metadataVersion}`, record);
    } else {
      const slices = validateStoredClipContent(database, projectId, record, group.createdRevision);
      for (const binding of slices.values()) for (const digest of [binding.digest, binding.sourceDigest, ...(binding.priorDigest ? [binding.priorDigest] : [])]) digests.add(digest);
      leaves.set(`${record.assetId}@${record.assetVersion}:${record.metadataVersion}`, { ...record,
        frameBindings: record.clip.frames.map(frame => ({ frameId: frame.frameId, sliceBinding: slices.get(`${frame.slice.sliceId}@${frame.slice.sliceVersion}`) })) });
    }
  }
  for (const item of group.items.filter(item => item.contentKind === 'assembly')) {
    const record = item.proposedRecord, assets = new Map();
    for (const slot of assemblyContentSlots(record.assembly)) {
      if (slot.content.kind === 'none') continue;
      const pin = slot.content.asset, key = `${pin.assetId}@${pin.assetVersion}:${pin.metadataVersion}`;
      let leaf = leaves.get(key);
      if (!leaf) leaf = slot.content.kind === 'animation' ? sqliteResolvedClip(database, projectId, pin, group.createdRevision)
        : sqliteAssemblyLeaves(database, projectId, { schemaVersion: 1, components: [{ componentId: slot.componentId, asset: pin, variantOverrides: [] }] }, group.createdRevision).get(key);
      assets.set(key, leaf);
    }
    const validated = validateAssemblyDefinition({ ...record, assets, projectId });
    for (const key of ['metadata', 'assembly', 'metadataFingerprint', 'contentFingerprint', 'findings', 'componentPins', 'frameBounds']) eq(validated[key], record[key], `Review Assembly ${key} differs from its exact components.`);
    invariant(!record.findings.some(finding => finding.severity === 'ERROR'), 'REVIEW_RECORD_CORRUPT', 'Review Assembly has unresolved technical errors.');
  }
  eq([...digests].sort(), database.prepare("SELECT digest FROM artifact_references WHERE project_id=? AND owner_kind='review_version' AND owner_id=? ORDER BY digest").all(projectId, `${group.reviewId}.v${group.reviewVersion}`).map(row => row.digest), 'Review source retention references differ from its exact content.');
  return true;
}
