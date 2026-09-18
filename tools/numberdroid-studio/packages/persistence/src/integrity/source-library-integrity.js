import { invariant } from '../../../domain/src/errors.js';
import { canonicalJson, fingerprint } from '../../../application/src/value-utils.js';

const check = (condition, message) => invariant(condition, 'SOURCE_LIBRARY_INTEGRITY_MISMATCH', message);

/** Operation receipts are workspace recovery records, never authority or portable content. */
export function inspectSourceLibraryIntegrity(database) {
  const findings = [];
  const coveredCommands = new Set();
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
        check(request.projectId === row.project_id && request.atlasId === row.atlas_id
          && Number.isSafeInteger(request.expectedRevision) && request.expectedRevision > 0,
        'Library request identity or base revision differs.');
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
        check(Array.isArray(request.items) && request.items.length === receipt.items.length,
          'Library receipt does not cover its requested destinations.');
        const commandPrefix = `source.library.${fingerprint({ projectId: row.project_id, operationKey: row.operation_key }).slice(0, 32)}`;
        const commands = receipt.status === 'SAVED' ? database.prepare(
          'SELECT revision_number, command_id, revision_json FROM revisions WHERE project_id=? AND revision_number BETWEEN ? AND ? ORDER BY revision_number')
          .all(row.project_id, row.first_revision, row.last_revision) : [];
        check(receipt.status === 'SAVED'
          ? row.first_revision === request.expectedRevision + 1 && commands.length === row.last_revision - row.first_revision + 1
          : row.first_revision === request.expectedRevision && row.last_revision === request.expectedRevision,
        'Library receipt revision range does not follow its request.');
        const committed = commands.map((value, index) => {
          const revision = JSON.parse(value.revision_json), command = revision.command;
          check(value.command_id === `${commandPrefix}.${index + 1}` && command.commandId === value.command_id
            && command.idempotencyKey === value.command_id && command.actor.kind === 'human' && command.actor.id === row.actor_id,
          'Library receipt range contains a foreign or misordered command.');
          return { ...value, command, result: revision.result };
        });
        const cutCount = request.input?.mode === 'generated' ? 1 : 0;
        check(['generated', 'saved'].includes(request.input?.mode), 'Library request input mode is invalid.');
        if (cutCount) check(committed[0]?.command.type === 'atlas.commit.slices'
          && committed[0].result.atlasId === row.atlas_id
          && committed[0].result.jobId === request.input.jobId,
        'Generated Library work has no matching cut commit.');
        const assetCommands = committed.slice(cutCount);
        check(assetCommands.every(value => value.command.type === 'asset.save'), 'Library receipt range includes an unrelated mutation.');
        const counts = { created: 0, updated: 0, unchanged: 0, skipped: 0 }, identities = new Set();
        for (const item of receipt.items) {
          check(Object.hasOwn(counts, item.status) && typeof item.rectangleId === 'string' && !identities.has(item.rectangleId),
            'Library receipt has invalid or repeated image identities.');
          identities.add(item.rectangleId); counts[item.status] += 1;
          const destination = request.items.find(value => value.rectangleId === item.rectangleId)?.destination;
          check(destination && (item.status === 'skipped' ? destination.operation === 'skip'
            : destination.assetId === item.assetId && (item.status === 'unchanged'
              ? ['create', 'update'].includes(destination.operation)
              : destination.operation === (item.status === 'created' ? 'create' : 'update'))),
          'Library receipt outcome differs from its requested destination.');
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
            check(assetCommands.some(value => value.revision_number === saved.created_revision
              && value.command.payload.assetId === item.assetId), 'Library receipt Asset has no matching workflow command.');
          }
        }
        check(fingerprint(counts) === fingerprint(receipt.summary), 'Library receipt summary differs from its item outcomes.');
        check(assetCommands.length === counts.created + counts.updated, 'Library receipt omits a saved Asset command.');
        check((receipt.status === 'SAVED') === (cutCount + counts.created + counts.updated > 0), 'Library receipt status contradicts its changes.');
        for (const command of committed) {
          const key = `${row.project_id}:${command.command_id}`;
          check(!coveredCommands.has(key), 'A Library command belongs to multiple receipts.');
          coveredCommands.add(key);
        }
      } catch (error) {
        findings.push({ projectId: row.project_id, operationKey: row.operation_key, code: error.code ?? 'SOURCE_LIBRARY_INTEGRITY_FAILED', message: error.message });
      }
    }
    for (const row of database.prepare("SELECT project_id, command_id FROM revisions WHERE command_id LIKE 'source.library.%'").all()) {
      if (!/^source\.library\.[a-f0-9]{32}\.[1-9][0-9]*$/.test(row.command_id)) continue;
      if (!coveredCommands.has(`${row.project_id}:${row.command_id}`)) findings.push({ projectId: row.project_id,
        code: 'SOURCE_LIBRARY_INTEGRITY_MISMATCH', message: 'Library workflow command has no valid operation receipt.' });
    }
  } catch (error) {
    findings.push({ projectId: null, code: error.code ?? 'SOURCE_LIBRARY_INTEGRITY_FAILED', message: error.message });
  }
  return { ok: findings.length === 0, operationCount, findings };
}
