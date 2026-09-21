import { invariant } from '../../../domain/src/errors.js';
import { requireId } from '../../../domain/src/validation.js';
import { canonicalJson, fingerprint } from '../../../application/src/value-utils.js';

function decode(row) {
  if (!row) return null;
  const request = JSON.parse(row.request_json), receipt = JSON.parse(row.receipt_json);
  invariant(fingerprint(receipt) === row.receipt_fingerprint,
    'SOURCE_LIBRARY_RECEIPT_CORRUPT', 'The saved Library operation receipt failed verification.');
  invariant(fingerprint({ actorId: row.actor_id, request }) === row.request_fingerprint,
    'SOURCE_LIBRARY_RECEIPT_CORRUPT', 'The saved Library operation request failed verification.');
  return { projectId: row.project_id, operationKey: row.operation_key, actorId: row.actor_id,
    atlasId: row.atlas_id, requestFingerprint: row.request_fingerprint, request, receipt,
    firstRevision: Number(row.first_revision), lastRevision: Number(row.last_revision), createdAt: row.created_at };
}

/** Workspace-local recovery evidence, not a capability and not portable authority. */
export class SourceLibraryOperationStore {
  #workspace;
  constructor({ workspace }) {
    invariant(workspace?.database, 'SOURCE_LIBRARY_UNAVAILABLE', 'Library workflow requires the authoritative SQLite workspace.');
    this.#workspace = workspace;
  }
  get workspace() { return this.#workspace; }
  get(projectId, operationKey) {
    requireId(projectId, 'projectId'); requireId(operationKey, 'idempotencyKey');
    return decode(this.#workspace.database.prepare('SELECT * FROM source_library_operations WHERE project_id = ? AND operation_key = ?')
      .get(projectId, operationKey));
  }
  listForAtlas(projectId, atlasId) {
    requireId(projectId, 'projectId'); requireId(atlasId, 'atlasId');
    return this.#workspace.database.prepare('SELECT * FROM source_library_operations WHERE project_id = ? AND atlas_id = ? ORDER BY last_revision DESC, created_at DESC, operation_key DESC')
      .all(projectId, atlasId).map(decode);
  }
  recordInTransaction(database, { projectId, operationKey, actorId, atlasId, request, receipt, firstRevision, lastRevision, createdAt }) {
    invariant(database === this.#workspace.database, 'SOURCE_LIBRARY_STORE_MISMATCH', 'Operation and content must share the same authoritative transaction.');
    database.prepare(`INSERT INTO source_library_operations(project_id, operation_key, actor_id, atlas_id,
      request_fingerprint, request_json, receipt_json, receipt_fingerprint, first_revision, last_revision, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(projectId, operationKey, actorId, atlasId,
      fingerprint({ actorId, request }), canonicalJson(request), canonicalJson(receipt), fingerprint(receipt), firstRevision, lastRevision, createdAt);
    this.#workspace.fault('after_source_library_operation_receipt');
  }
  /** An unchanged operation has no content revision, but its exact retry is still durable. */
  recordUnchanged(operation, expectedRevision) {
    return this.#workspace.transaction(database => {
      const project = database.prepare('SELECT head_revision FROM projects WHERE project_id = ?').get(operation.projectId);
      invariant(project && Number(project.head_revision) === expectedRevision,
        'REVISION_CONFLICT', 'The project changed while unchanged Library work was checked.');
      this.recordInTransaction(database, operation);
    });
  }
}
