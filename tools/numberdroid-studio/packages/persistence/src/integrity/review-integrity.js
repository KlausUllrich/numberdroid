import { invariant } from '../../../domain/src/errors.js';
import { fingerprint } from '../../../application/src/value-utils.js';
import { applyReviewCommand } from '../../../application/src/review-service.js';
import { applyReviewItem } from '../../../application/src/studio-service.js';
import { REVIEW_CONTENT_LIBRARIES, reviewAcceptanceTable, assertReviewSavedRecord, verifyReviewContent } from '../sqlite/sqlite-review-store.js';

const eq = (a, b, message) => invariant(fingerprint(a) === fingerprint(b), 'REVIEW_INTEGRITY_MISMATCH', message);
export function inspectReviewIntegrity(database) {
  const findings = []; let versionCount = 0, acceptedCount = 0;
  for (const project of database.prepare('SELECT project_id,head_snapshot_json FROM projects').all()) {
    try {
      const projectId = project.project_id;
      const revisions = database.prepare('SELECT command_type,revision_json FROM revisions WHERE project_id=? ORDER BY revision_number').all(projectId)
        .map(row => ({ sqlType: row.command_type, ...JSON.parse(row.revision_json) }));
      const rows = database.prepare('SELECT * FROM review_versions WHERE project_id=? ORDER BY review_id,review_version').all(projectId);
      versionCount += rows.length;
      const heads = new Map();
      for (const row of rows) {
        const group = JSON.parse(row.record_json), before = heads.get(row.review_id);
        invariant(fingerprint(group) === row.record_fingerprint && group.reviewId === row.review_id && group.reviewVersion === row.review_version
          && group.previousReviewVersion === row.previous_review_version && group.contentVersion === row.content_version && group.status === row.status
          && group.createdRevision === row.created_revision && group.reviewVersion === (before?.reviewVersion ?? 0) + 1,
        'REVIEW_INTEGRITY_MISMATCH', 'Review version identity, sequence or fingerprint differs.');
        const revision = revisions.find(value => value.number === row.created_revision);
        invariant(revision?.sqlType === revision.command.type && revision.command.type.startsWith('review.'), 'REVIEW_INTEGRITY_MISMATCH', 'Review history lacks its semantic command.');
        eq(revision.snapshot.reviewLibrary?.groups.find(value => value.reviewId === group.reviewId), group, 'Review row differs from its creation snapshot.');
        const items = database.prepare('SELECT * FROM review_items WHERE project_id=? AND review_id=? AND review_version=? ORDER BY item_order').all(projectId, group.reviewId, group.reviewVersion);
        eq(items.map(row => JSON.parse(row.item_json)), group.items, 'Ordered Review item projection differs.');
        for (const [order, item] of group.items.entries()) {
          const itemRow = items[order];
          invariant(itemRow.item_id === item.itemId && itemRow.item_order === order && itemRow.content_kind === item.contentKind && itemRow.status === item.status,
            'REVIEW_INTEGRITY_MISMATCH', 'Review item projection columns differ.');
          const dependencies = database.prepare('SELECT dependency_id,dependency_order FROM review_dependencies WHERE project_id=? AND review_id=? AND review_version=? AND item_id=? ORDER BY dependency_order').all(projectId, group.reviewId, group.reviewVersion, item.itemId);
          eq(dependencies.map((entry, order) => ({ id: entry.dependency_id, order: entry.dependency_order })), item.dependsOn.map((id, order) => ({ id, order })), 'Review dependency projection differs.');
        }
        const event = database.prepare('SELECT * FROM review_events WHERE project_id=? AND review_id=? AND review_version=?').get(projectId, group.reviewId, group.reviewVersion);
        invariant(event?.command_type === revision.command.type, 'REVIEW_INTEGRITY_MISMATCH', 'Review event command differs.');
        eq(event.feedback_json ? JSON.parse(event.feedback_json) : null, group.feedback, 'Saved Review feedback projection differs.');
        eq(event.decision_json ? JSON.parse(event.decision_json) : null, group.decision, 'Saved Review decision projection differs.');
        verifyReviewContent(database, projectId, group);
        heads.set(group.reviewId, group);
      }
      const ordered = values => [...values].sort((a, b) => a.reviewId.localeCompare(b.reviewId));
      const snapshot = JSON.parse(project.head_snapshot_json);
      eq(ordered(heads.values()), ordered(snapshot.reviewLibrary?.groups ?? []), 'Review heads differ from the project snapshot.');
      eq([...heads.values()].map(group => [group.reviewId, group.reviewVersion]), database.prepare('SELECT review_id,review_version FROM review_heads WHERE project_id=? ORDER BY review_id').all(projectId).map(row => [row.review_id, row.review_version]), 'Review head projection differs.');
      for (const [kind, library] of Object.entries(REVIEW_CONTENT_LIBRARIES)) {
        const acceptances = database.prepare(`SELECT * FROM ${reviewAcceptanceTable(kind)} WHERE project_id=?`).all(projectId);
        acceptedCount += acceptances.length;
        const expected = [...heads.values()].flatMap(group => group.items.filter(item => item.contentKind === kind && item.status === 'ACCEPTED')
          .map(item => [group.reviewId, item.itemId, item.accepted]));
        invariant(acceptances.length === expected.length, 'REVIEW_INTEGRITY_MISMATCH', 'Every accepted item requires exactly one durable typed receipt.');
        for (const [reviewId, itemId, pin] of expected) {
          const revision = revisions.find(value => value.number === pin.revision);
          const record = revision?.snapshot[library]?.assets.find(value => value.assetId === pin.assetId && value.assetVersion === pin.assetVersion);
          invariant(record?.review?.reviewId === reviewId && record.review.itemId === itemId, 'REVIEW_INTEGRITY_MISMATCH', 'Accepted item does not identify its saved content.');
          assertReviewSavedRecord(database, projectId, kind, record, pin.revision);
        }
      }
      for (const revision of revisions.filter(value => value.command.type.startsWith('review.') || value.sqlType.startsWith('review.'))) {
        const prior = revisions.find(value => value.number === revision.number - 1);
        invariant(prior && revision.sqlType === revision.command.type, 'REVIEW_INTEGRITY_MISMATCH', 'Review command lost its exact base or command identity.');
        const command = { ...revision.command, projectId, baseRevision: prior.number };
        if (command.type !== 'review.proposal.submit') invariant(command.actor.kind === 'human' && command.actor.id === prior.snapshot.project.ownerId, 'REVIEW_INTEGRITY_MISMATCH', 'Only the owner may decide Review work.');
        const replay = applyReviewCommand(command, structuredClone(prior.snapshot), { projectId, revisions: revisions.filter(value => value.number <= prior.number) }, revision.committedAt, { applyItem: applyReviewItem });
        for (const key of ['reviewLibrary', ...Object.values(REVIEW_CONTENT_LIBRARIES)]) eq(replay.snapshot[key] ?? null, revision.snapshot[key] ?? null, 'Review command replay differs from saved libraries.');
        eq(replay.result, revision.result, 'Review command replay differs from its exact receipt.');
      }
      for (const revision of revisions.filter(value => !value.command.type.startsWith('review.'))) {
        const prior = revisions.find(value => value.number === revision.number - 1);
        eq(prior?.snapshot.reviewLibrary ?? null, revision.snapshot.reviewLibrary ?? null, 'An unrelated command replaced Review history.');
      }
    } catch (error) { findings.push({ projectId: project.project_id, code: error.code ?? 'REVIEW_INTEGRITY_FAILED', message: error.message }); }
  }
  return { ok: findings.length === 0, versionCount, acceptedCount, findings };
}
