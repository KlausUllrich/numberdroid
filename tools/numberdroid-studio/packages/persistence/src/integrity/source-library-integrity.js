import { invariant } from '../../../domain/src/errors.js';
import { canonicalJson, fingerprint } from '../../../application/src/value-utils.js';

const check = (condition, message) => invariant(condition, 'SOURCE_LIBRARY_INTEGRITY_MISMATCH', message);

/** Operation receipts are workspace recovery records, never authority or portable content. */
export function inspectSourceLibraryIntegrity(database) {
  const findings = [];
  let operationCount = 0;
  try {
    for (const row of database.prepare('SELECT * FROM source_library_operations ORDER BY project_id, operation_key').all()) {
      operationCount += 1;
      try {
        const request = JSON.parse(row.request_json), receipt = JSON.parse(row.receipt_json);
        check(canonicalJson(request) === row.request_json && canonicalJson(receipt) === row.receipt_json,
          'Library operation JSON is not canonical.');
        check(fingerprint({ actorId: row.actor_id, request }) === row.request_fingerprint
          && fingerprint(receipt) === row.receipt_fingerprint, 'Library operation fingerprints differ.');
        check(receipt.schemaVersion === 1 && receipt.projectId === row.project_id && receipt.atlasId === row.atlas_id
          && receipt.revision === row.last_revision && receipt.replayed === false,
        'Library receipt identity or revision differs.');
        check(Number.isSafeInteger(row.first_revision) && row.first_revision > 0 && row.first_revision <= row.last_revision,
          'Library operation revision range is invalid.');
        const revisionRow = database.prepare('SELECT revision_json FROM revisions WHERE project_id=? AND revision_number=?').get(row.project_id, row.last_revision);
        const revision = revisionRow && JSON.parse(revisionRow.revision_json);
        check(revision && revision.snapshot.project.ownerId === row.actor_id, 'Library operation actor is not its project owner.');
        check(revision.snapshot.atlases?.some(atlas => atlas.id === row.atlas_id), 'Library operation atlas is absent from its saved revision.');
        check(['SAVED', 'UNCHANGED'].includes(receipt.status) && Array.isArray(receipt.items) && receipt.items.length <= 128,
          'Library operation status or item list is invalid.');
        const counts = { created: 0, updated: 0, unchanged: 0, skipped: 0 }, identities = new Set();
        for (const item of receipt.items) {
          check(Object.hasOwn(counts, item.status) && typeof item.rectangleId === 'string' && !identities.has(item.rectangleId),
            'Library receipt has invalid or repeated image identities.');
          identities.add(item.rectangleId); counts[item.status] += 1;
          if (item.status === 'skipped') continue;
          const saved = database.prepare('SELECT * FROM asset_versions WHERE project_id=? AND asset_id=? AND asset_version=?')
            .get(row.project_id, item.assetId, item.assetVersion);
          check(saved && saved.metadata_version === item.metadataVersion && saved.name === item.name && saved.kind === item.kind
            && saved.created_revision <= row.last_revision, 'Library receipt does not match its immutable saved Asset.');
          const savedRevisionRow = database.prepare('SELECT revision_json FROM revisions WHERE project_id=? AND revision_number=?')
            .get(row.project_id, saved.created_revision);
          const savedRevision = savedRevisionRow && JSON.parse(savedRevisionRow.revision_json);
          const asset = savedRevision?.snapshot.assetLibrary?.assets.find(value => value.assetId === item.assetId && value.assetVersion === item.assetVersion);
          check(asset && fingerprint(asset.sliceBinding) === fingerprint(item.sliceBinding), 'Library receipt changed its exact saved image binding.');
          check(item.sliceBinding?.atlasId === row.atlas_id && item.sliceBinding?.rectangleId === item.rectangleId,
            'Library receipt image is outside its source cut.');
          if (item.status !== 'unchanged') {
            check(saved.created_revision >= row.first_revision && savedRevision.command.type === 'asset.save'
              && savedRevision.command.actor.kind === 'human' && savedRevision.command.actor.id === row.actor_id,
            'Library receipt mutation has no owner Save inside its atomic revision range.');
            check((item.status === 'created') === (saved.asset_version === 1), 'Library receipt create/update result differs from saved history.');
          }
        }
        check(fingerprint(counts) === fingerprint(receipt.summary), 'Library receipt summary differs from its item outcomes.');
        check((receipt.status === 'UNCHANGED') === (counts.created + counts.updated === 0), 'Library receipt status contradicts its changes.');
        if (receipt.status === 'UNCHANGED') check(row.first_revision === row.last_revision, 'Unchanged Library work invented a content revision range.');
      } catch (error) {
        findings.push({ projectId: row.project_id, operationKey: row.operation_key, code: error.code ?? 'SOURCE_LIBRARY_INTEGRITY_FAILED', message: error.message });
      }
    }
  } catch (error) {
    findings.push({ projectId: null, code: error.code ?? 'SOURCE_LIBRARY_INTEGRITY_FAILED', message: error.message });
  }
  return { ok: findings.length === 0, operationCount, findings };
}
