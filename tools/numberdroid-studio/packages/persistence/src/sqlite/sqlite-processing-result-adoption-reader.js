import { types as utilTypes } from 'node:util';
import {
  createProcessingResultAdoptionPlan,
  processingResultAdoptionCommitResultSha256,
  validateProcessingResultAdoptionAggregate,
  validateProcessingResultAdoptionCommitResult,
} from '../../../domain/src/index.js';
import { StudioError, invariant } from '../../../domain/src/errors.js';
import { requireId, requireInteger } from '../../../domain/src/validation.js';
import {
  PROCESSING_RESULT_ADOPTION_READ_FACTS_KIND,
  PROCESSING_RESULT_ADOPTION_READER_KIND,
  PROCESSING_RESULT_ADOPTION_READER_SCHEMA_VERSION,
} from '../../../application/src/processing-result-adoption-read.js';
import { fingerprint } from '../../../application/src/value-utils.js';
import { ContentAddressedArtifactStore } from '../artifacts/content-addressed-artifact-store.js';
import { assertSqliteVersion } from './migration-runner.js';
import { SqliteWorkspace } from './sqlite-workspace.js';

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch {
    throw new StudioError(
      'CORRUPT_PROCESSING_RESULT_ADOPTION',
      `Stored ${label} is not valid JSON.`,
    );
  }
}

function sameValue(left, right) {
  try {
    return fingerprint(left) === fingerprint(right);
  } catch {
    return false;
  }
}

function withoutGrantAuthorizationStatus(revision) {
  const comparable = structuredClone(revision);
  for (const grant of comparable?.snapshot?.grants ?? []) delete grant.authorizationStatus;
  return comparable;
}

function assertSelection(value, { includeRevision = false } = {}) {
  invariant(
    value && typeof value === 'object' && !Array.isArray(value) && value.schemaVersion === 1,
    'PROCESSING_RESULT_ADOPTION_READ_REQUEST_INVALID',
    'Processing-result adoption reads require a schema-v1 selection.',
  );
  const allowed = includeRevision
    ? ['schemaVersion', 'projectId', 'taskId', 'branchRevision']
    : ['schemaVersion', 'projectId', 'taskId'];
  invariant(
    Object.keys(value).length === allowed.length
      && Object.keys(value).every((field) => allowed.includes(field)),
    'PROCESSING_RESULT_ADOPTION_READ_REQUEST_INVALID',
    'Processing-result adoption selection contains unsupported fields.',
  );
  return Object.freeze({
    schemaVersion: 1,
    projectId: requireId(value.projectId, 'projectId'),
    taskId: requireId(value.taskId, 'taskId'),
    ...(includeRevision ? {
      branchRevision: requireInteger(value.branchRevision, 'branchRevision', { min: 2 }),
    } : {}),
  });
}

function taskRow(database, projectId, taskId) {
  const row = database.prepare(`
    SELECT * FROM agent_tasks WHERE project_id = ? AND task_id = ?
  `).get(projectId, taskId);
  if (!row) throw new StudioError('TASK_NOT_FOUND', 'The agent task does not exist.');
  const task = parseJson(row.task_json, 'agent task');
  const baseDocument = parseJson(row.base_document_json, 'agent task base document');
  const headDocument = parseJson(row.head_document_json, 'agent task head document');
  const baseRevisions = baseDocument?.revisions;
  const headRevisions = headDocument?.revisions;
  const baseHead = baseDocument?.revisions?.at(-1);
  const branchHead = headDocument?.revisions?.at(-1);
  const baseRevision = Number(row.base_revision);
  const headRevision = Number(row.head_revision);
  const branchRevisionCount = headRevision - baseRevision;
  const project = database.prepare(`
    SELECT format_version, created_at FROM projects WHERE project_id = ?
  `).get(projectId);
  const durableBaseRevisions = Number.isSafeInteger(baseRevision) && baseRevision >= 1
    ? database.prepare(`
      SELECT revision_number, revision_json
      FROM revisions
      WHERE project_id = ? AND revision_number <= ?
      ORDER BY revision_number
    `).all(projectId, baseRevision)
    : [];
  const baseSequenceClosed = Array.isArray(baseRevisions)
    && baseRevisions.length === baseRevision
    && durableBaseRevisions.length === baseRevision
    && durableBaseRevisions.every((durable, index) => {
      const expectedRevision = index + 1;
      const revision = baseRevisions[index];
      const durableRevision = parseJson(
        durable.revision_json,
        'agent task durable base revision',
      );
      const storedComparable = index === baseRevision - 1
        ? withoutGrantAuthorizationStatus(revision)
        : revision;
      const durableComparable = index === baseRevision - 1
        ? withoutGrantAuthorizationStatus(durableRevision)
        : durableRevision;
      return Number(durable.revision_number) === expectedRevision
        && revision?.number === expectedRevision
        && revision.parentRevision === index
        && sameValue(storedComparable, durableComparable);
    });
  const headAtBase = Array.isArray(headRevisions)
    ? { ...headDocument, revisions: headRevisions.slice(0, baseRevisions?.length) }
    : null;
  invariant(
    task.projectId === projectId
      && task.taskId === taskId
      && task.branchId === row.branch_id
      && task.agentId === row.agent_id
      && (task.grantId ?? null) === row.grant_id
      && task.baseRevision === Number(row.base_revision)
      && task.state === row.state
      && task.headRevision === Number(row.head_revision)
      && task.expiresAt === row.expires_at
      && task.createdAt === row.created_at
      && task.updatedAt === row.updated_at
      && Array.isArray(baseRevisions)
      && Array.isArray(headRevisions)
      && baseDocument?.formatVersion === Number(project?.format_version)
      && baseDocument?.createdAt === project?.created_at
      && baseSequenceClosed
      && branchRevisionCount >= 0
      && headRevisions.length === baseRevisions.length + branchRevisionCount
      && sameValue(headAtBase, baseDocument)
      && baseDocument?.projectId === projectId
      && headDocument?.projectId === projectId
      && Number(baseHead?.number) === baseRevision
      && Number(branchHead?.number) === headRevision,
    'CORRUPT_PROCESSING_RESULT_ADOPTION',
    'The task row does not close over its durable task projection.',
  );
  return Object.freeze({ row, baseDocument, headDocument });
}

function exactEvidence(referenceRow) {
  const evidence = parseJson(referenceRow.evidence_json, 'processing-result adoption evidence');
  const { evidenceFingerprint, ...body } = evidence ?? {};
  const evidenceKeys = Object.keys(evidence ?? {}).sort();
  const metadataKeys = Object.keys(evidence?.metadata ?? {}).sort();
  const physicalKeys = Object.keys(evidence?.physical ?? {}).sort();
  invariant(
    JSON.stringify(evidenceKeys) === JSON.stringify([
      'descriptor', 'evidenceFingerprint', 'metadata', 'physical', 'role', 'verifiedAt',
    ])
      && JSON.stringify(metadataKeys) === JSON.stringify([
        'artifactUri', 'byteSize', 'height', 'mediaType', 'sha256', 'state', 'width',
      ])
      && JSON.stringify(physicalKeys) === JSON.stringify([
        'byteSize', 'height', 'mediaType', 'sha256', 'width',
      ])
      && evidence.role === referenceRow.role
      && evidence.verifiedAt === referenceRow.verified_at
      && evidence.descriptor?.artifactUri === referenceRow.artifact_uri
      && evidence.descriptor?.sha256 === referenceRow.digest
      && evidence.descriptor?.mediaType === referenceRow.media_type
      && evidence.descriptor?.byteSize === Number(referenceRow.byte_size)
      && evidence.descriptor?.width === Number(referenceRow.width)
      && evidence.descriptor?.height === Number(referenceRow.height)
      && evidence.metadata?.artifactUri === referenceRow.artifact_uri
      && evidence.metadata?.sha256 === referenceRow.digest
      && evidence.metadata?.mediaType === referenceRow.media_type
      && evidence.metadata?.byteSize === Number(referenceRow.byte_size)
      && evidence.metadata?.width === Number(referenceRow.width)
      && evidence.metadata?.height === Number(referenceRow.height)
      && evidence.metadata?.state === 'LIVE'
      && evidence.physical?.sha256 === referenceRow.digest
      && evidence.physical?.mediaType === referenceRow.media_type
      && evidence.physical?.byteSize === Number(referenceRow.byte_size)
      && evidence.physical?.width === Number(referenceRow.width)
      && evidence.physical?.height === Number(referenceRow.height)
      && evidenceFingerprint === referenceRow.evidence_fingerprint
      && fingerprint(body) === referenceRow.evidence_fingerprint,
    'CORRUPT_PROCESSING_RESULT_ADOPTION',
    'Stored processing-result adoption evidence does not match its immutable descriptor.',
  );
}

function descriptorMatchesRow(descriptor, row) {
  return descriptor?.sha256 === row.digest
    && descriptor.artifactUri === row.artifact_uri
    && descriptor.mediaType === row.media_type
    && descriptor.byteSize === Number(row.byte_size)
    && descriptor.width === Number(row.width)
    && descriptor.height === Number(row.height);
}

function livePreviewState(database, referenceRow) {
  const artifact = database.prepare(`
    SELECT uri, media_type, byte_size, width, height, state
    FROM artifacts WHERE digest = ?
  `).get(referenceRow.digest);
  const markedForCollection = Boolean(database.prepare(`
    SELECT 1 FROM cas_gc_marks WHERE digest = ? LIMIT 1
  `).get(referenceRow.digest));
  const exact = artifact?.uri === referenceRow.artifact_uri
    && artifact?.media_type === referenceRow.media_type
    && Number(artifact?.byte_size) === Number(referenceRow.byte_size)
    && Number(artifact?.width) === Number(referenceRow.width)
    && Number(artifact?.height) === Number(referenceRow.height);
  return exact && artifact.state === 'LIVE' && !markedForCollection ? 'READY' : 'UNAVAILABLE';
}

function closedAdoption(database, taskRecord, adoption) {
  const task = taskRecord.row;
  let aggregate;
  let result;
  try {
    aggregate = validateProcessingResultAdoptionAggregate(parseJson(
      adoption.record_json,
      'processing-result adoption aggregate',
    ));
    result = validateProcessingResultAdoptionCommitResult(parseJson(
      adoption.result_json,
      'processing-result adoption result',
    ));
  } catch {
    throw new StudioError(
      'CORRUPT_PROCESSING_RESULT_ADOPTION',
      'A stored processing-result adoption record failed integrity validation.',
    );
  }
  let plan;
  try {
    plan = createProcessingResultAdoptionPlan(
      aggregate.command,
      aggregate.authorityBinding,
      aggregate.freshPreflightReceipt,
    );
  } catch {
    throw new StudioError(
      'CORRUPT_PROCESSING_RESULT_ADOPTION',
      'A stored processing-result adoption plan failed integrity validation.',
    );
  }
  const resultFingerprint = processingResultAdoptionCommitResultSha256(result);
  invariant(
    aggregate.project.projectId === adoption.project_id
      && aggregate.project.taskId === adoption.task_id
      && aggregate.project.branchId === adoption.branch_id
      && aggregate.project.branchRevision === Number(adoption.branch_revision)
      && task.branch_id === adoption.branch_id
      && task.state !== 'MERGED'
      && aggregate.operation === adoption.operation
      && aggregate.command.commandId === adoption.command_id
      && aggregate.command.idempotencyKey === adoption.idempotency_key
      && aggregate.asset.assetId === adoption.asset_id
      && aggregate.asset.kind === adoption.asset_kind
      && aggregate.asset.assetVersion === Number(adoption.asset_version)
      && aggregate.asset.metadataVersion === Number(adoption.metadata_version)
      && aggregate.commandFingerprint === adoption.command_fingerprint
      && aggregate.semanticFingerprint === adoption.semantic_fingerprint
      && plan.authority.bindingFingerprint === adoption.authority_binding_fingerprint
      && aggregate.freshPreflightReceiptFingerprint === adoption.preflight_receipt_fingerprint
      && aggregate.asset.processingBinding.fingerprint === adoption.processing_binding_fingerprint
      && aggregate.planFingerprint === adoption.plan_fingerprint
      && aggregate.asset.metadataFingerprint === adoption.metadata_fingerprint
      && aggregate.asset.findingsFingerprint === adoption.findings_fingerprint
      && resultFingerprint === adoption.result_fingerprint
      && aggregate.committedAt === adoption.committed_at
      && aggregate.committedBy === adoption.committed_by
      && aggregate.commandBudgetCharge === 1
      && result.commandBudgetCharge === 1
      && sameValue(aggregate.commitResult, result),
    'CORRUPT_PROCESSING_RESULT_ADOPTION',
    'Stored processing-result adoption columns do not match the immutable Aggregate.',
  );

  const branch = database.prepare(`
    SELECT * FROM task_branch_revisions
    WHERE project_id = ? AND task_id = ? AND branch_revision = ?
  `).get(adoption.project_id, adoption.task_id, adoption.branch_revision);
  const branchValue = branch
    ? parseJson(branch.revision_json, 'processing-result adoption branch revision')
    : null;
  invariant(
    branch
      && branch.branch_id === adoption.branch_id
      && branch.command_id === adoption.command_id
      && branch.idempotency_key === adoption.idempotency_key
      && branch.command_type === 'asset.processing-result.adopt'
      && branch.committed_at === adoption.committed_at
      && branchValue?.command?.commandId === aggregate.command.commandId
      && branchValue.command.idempotencyKey === aggregate.command.idempotencyKey
      && branchValue.command.type === aggregate.command.type
      && branchValue.command.fingerprint === aggregate.commandFingerprint
      && sameValue(branchValue.command.payload, aggregate.command.payload)
      && sameValue(branchValue.result, result)
      && branchValue.event?.commandId === aggregate.command.commandId
      && branchValue.event?.commandType === aggregate.command.type
      && branchValue.snapshot?.processingResultAdoptionHeads?.schemaVersion === 1
      && sameValue(
        branchValue.snapshot.processingResultAdoptionHeads.assets?.find(
          (asset) => asset.assetId === aggregate.asset.assetId,
        ),
        aggregate.asset,
      ),
    'CORRUPT_PROCESSING_RESULT_ADOPTION',
    'The immutable task-branch ledger does not match its processing-result adoption.',
  );

  const references = database.prepare(`
    SELECT * FROM task_branch_processing_result_artifact_references
    WHERE project_id = ? AND task_id = ? AND branch_revision = ?
    ORDER BY role
  `).all(adoption.project_id, adoption.task_id, adoption.branch_revision);
  const byRole = new Map(references.map((row) => [row.role, row]));
  invariant(
    references.length === 2 && byRole.has('recipe-input') && byRole.has('selected-output'),
    'CORRUPT_PROCESSING_RESULT_ADOPTION',
    'A processing-result adoption must retain exactly its two fixed artifact roles.',
  );
  const expected = new Map(aggregate.permanentReferences.map((reference) => [
    reference.role,
    reference.descriptor,
  ]));
  for (const reference of references) {
    invariant(
      descriptorMatchesRow(expected.get(reference.role), reference)
        && reference.verified_at === adoption.committed_at,
      'CORRUPT_PROCESSING_RESULT_ADOPTION',
      'A processing-result adoption artifact role does not match its immutable Aggregate.',
    );
    exactEvidence(reference);
  }
  const selectedOutput = byRole.get('selected-output');
  return Object.freeze({
    aggregate,
    previewState: livePreviewState(database, selectedOutput),
    selectedOutput: Object.freeze({
      digest: selectedOutput.digest,
      mediaType: selectedOutput.media_type,
      byteSize: Number(selectedOutput.byte_size),
      width: Number(selectedOutput.width),
      height: Number(selectedOutput.height),
    }),
  });
}

function adoptionRows(database, projectId, taskId, branchRevision = null) {
  if (branchRevision !== null) {
    const row = database.prepare(`
      SELECT * FROM task_branch_processing_result_adoptions
      WHERE project_id = ? AND task_id = ? AND branch_revision = ?
    `).get(projectId, taskId, branchRevision);
    return row ? [row] : [];
  }
  return database.prepare(`
    SELECT * FROM task_branch_processing_result_adoptions
    WHERE project_id = ? AND task_id = ?
    ORDER BY branch_revision
  `).all(projectId, taskId);
}

function closedTaskAdoptions(database, task, projectId, taskId) {
  const rows = adoptionRows(database, projectId, taskId);
  const records = rows.map((row) => closedAdoption(database, task, row));
  const recordsByRevision = new Map(records.map((record) => [
    record.aggregate.project.branchRevision,
    record,
  ]));
  const expectedHeads = new Map();
  const revisions = database.prepare(`
    SELECT *
    FROM task_branch_revisions
    WHERE project_id = ? AND task_id = ?
    ORDER BY branch_revision
  `).all(projectId, taskId);
  const expectedHead = Number(task.row.base_revision) + revisions.length;
  invariant(
    expectedHead === Number(task.row.head_revision),
    'CORRUPT_PROCESSING_RESULT_ADOPTION',
    'Task branch revisions are missing or non-consecutive.',
  );
  for (const [index, revision] of revisions.entries()) {
    const branchRevision = Number(revision.branch_revision);
    const expectedRevision = Number(task.row.base_revision) + index + 1;
    const revisionValue = parseJson(
      revision.revision_json,
      'processing-result adoption branch history',
    );
    const documentRevision = task.headDocument.revisions[
      task.baseDocument.revisions.length + index
    ];
    invariant(
      revision.project_id === projectId
        && revision.task_id === taskId
        && revision.branch_id === task.row.branch_id
        && branchRevision === expectedRevision
        && revisionValue?.id === revision.revision_id
        && revisionValue.number === expectedRevision
        && revisionValue.parentRevision === expectedRevision - 1
        && revisionValue.command?.commandId === revision.command_id
        && revisionValue.command?.idempotencyKey === revision.idempotency_key
        && revisionValue.command?.type === revision.command_type
        && revisionValue.command?.branchId === task.row.branch_id
        && revisionValue.command?.taskId === taskId
        && revisionValue.committedAt === revision.committed_at
        && sameValue(documentRevision, revisionValue),
      'CORRUPT_PROCESSING_RESULT_ADOPTION',
      'A task branch revision does not match its immutable task head.',
    );
    const record = recordsByRevision.get(branchRevision) ?? null;
    invariant(
      revision.command_type !== 'asset.processing-result.adopt' || record !== null,
      'CORRUPT_PROCESSING_RESULT_ADOPTION',
      'An adoption task-branch revision has no immutable adoption record.',
    );
    if (record) {
      expectedHeads.set(record.aggregate.asset.assetId, record.aggregate.asset);
    }
    const actual = revisionValue?.snapshot?.processingResultAdoptionHeads;
    const expectedAssets = [...expectedHeads.values()]
      .sort((left, right) => left.assetId.localeCompare(right.assetId));
    invariant(
      expectedAssets.length === 0
        ? actual === undefined
        : actual?.schemaVersion === 1 && sameValue(actual.assets, expectedAssets),
      'CORRUPT_PROCESSING_RESULT_ADOPTION',
      'Private processing-result adoption heads do not match immutable branch history.',
    );
  }
  return records;
}

function abort(signal) {
  if (signal !== undefined) AbortSignal.prototype.throwIfAborted.call(signal);
}

function expectedReaderErrorCode(error) {
  if (error === null || typeof error !== 'object' || utilTypes.isProxy(error)) return null;
  try {
    if (Object.getPrototypeOf(error) !== StudioError.prototype) return null;
    const descriptor = Object.getOwnPropertyDescriptor(error, 'code');
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
    return [
      'TASK_NOT_FOUND',
      'PROCESSING_RESULT_ADOPTION_NOT_FOUND',
      'PROCESSING_RESULT_ADOPTION_PREVIEW_UNAVAILABLE',
    ].includes(descriptor.value) ? descriptor.value : null;
  } catch {
    return null;
  }
}

function safeReadFailure(error) {
  const code = expectedReaderErrorCode(error);
  if (code === 'TASK_NOT_FOUND') {
    throw new StudioError(code, 'The agent task does not exist.');
  }
  if (code === 'PROCESSING_RESULT_ADOPTION_NOT_FOUND') {
    throw new StudioError(code, 'The selected processing-result adoption does not exist.');
  }
  if (code === 'PROCESSING_RESULT_ADOPTION_PREVIEW_UNAVAILABLE') {
    throw new StudioError(code, 'The exact processed image preview is unavailable.');
  }
  throw new StudioError(
    'CORRUPT_PROCESSING_RESULT_ADOPTION',
    'Processed asset details failed closed integrity validation.',
  );
}

export class SqliteProcessingResultAdoptionReader {
  #workspace;

  #artifactStore;

  constructor({ workspace, artifactStore } = {}) {
    invariant(workspace instanceof SqliteWorkspace, 'VALIDATION_ERROR', 'SqliteWorkspace is required.');
    invariant(artifactStore instanceof ContentAddressedArtifactStore, 'VALIDATION_ERROR', 'ContentAddressedArtifactStore is required.');
    this.#workspace = workspace;
    this.#artifactStore = artifactStore;
  }

  asReader() {
    const reader = this;
    return Object.freeze({
      schemaVersion: PROCESSING_RESULT_ADOPTION_READER_SCHEMA_VERSION,
      kind: PROCESSING_RESULT_ADOPTION_READER_KIND,
      readTaskAdoptions: async (selection, options) => reader.readTaskAdoptions(selection, options),
      withSelectedOutput: (selection, operation, options) => (
        reader.withSelectedOutput(selection, operation, options)
      ),
    });
  }

  readTaskAdoptions(selectionValue, { signal } = {}) {
    const selection = assertSelection(selectionValue);
    abort(signal);
    try {
      return this.#workspace.readTransaction((database) => {
        assertSqliteVersion(database);
        const task = taskRow(database, selection.projectId, selection.taskId);
        const adoptions = closedTaskAdoptions(
          database,
          task,
          selection.projectId,
          selection.taskId,
        ).map((record) => Object.freeze({
            aggregate: record.aggregate,
            previewState: record.previewState,
          }));
        abort(signal);
        return Object.freeze({
          schemaVersion: 1,
          kind: PROCESSING_RESULT_ADOPTION_READ_FACTS_KIND,
          projectId: selection.projectId,
          taskId: selection.taskId,
          adoptions: Object.freeze(adoptions),
        });
      });
    } catch (error) {
      abort(signal);
      safeReadFailure(error);
    }
  }

  async withSelectedOutput(selectionValue, operation, { signal } = {}) {
    const selection = assertSelection(selectionValue, { includeRevision: true });
    invariant(
      typeof operation === 'function',
      'PROCESSING_RESULT_ADOPTION_READ_REQUEST_INVALID',
      'Selected-output reads require an operation callback.',
    );
    abort(signal);
    let initial;
    try {
      initial = this.#workspace.readTransaction((database) => {
        assertSqliteVersion(database);
        const task = taskRow(database, selection.projectId, selection.taskId);
        const records = closedTaskAdoptions(
          database,
          task,
          selection.projectId,
          selection.taskId,
        );
        const record = records.find(
          ({ aggregate }) => aggregate.project.branchRevision === selection.branchRevision,
        );
        if (!record) {
          throw new StudioError(
            'PROCESSING_RESULT_ADOPTION_NOT_FOUND',
            'The selected processing-result adoption does not exist.',
          );
        }
        if (record.previewState !== 'READY') {
          throw new StudioError(
            'PROCESSING_RESULT_ADOPTION_PREVIEW_UNAVAILABLE',
            'The exact processed image preview is unavailable.',
          );
        }
        return record.selectedOutput;
      });
    } catch (error) {
      abort(signal);
      safeReadFailure(error);
    }

    try {
      return await this.#artifactStore.withVerifiedPngReadable(
        initial.digest,
        async ({ evidence, readable }) => {
          abort(signal);
          const current = this.#workspace.readTransaction((database) => {
            assertSqliteVersion(database);
            const task = taskRow(database, selection.projectId, selection.taskId);
            const records = closedTaskAdoptions(
              database,
              task,
              selection.projectId,
              selection.taskId,
            );
            const record = records.find(
              ({ aggregate }) => aggregate.project.branchRevision === selection.branchRevision,
            );
            if (!record) {
              throw new StudioError(
                'PROCESSING_RESULT_ADOPTION_NOT_FOUND',
                'The selected processing-result adoption does not exist.',
              );
            }
            return record;
          });
          const descriptor = current.selectedOutput;
          invariant(
            current.previewState === 'READY'
              && descriptor.digest === initial.digest
              && descriptor.mediaType === evidence.mediaType
              && descriptor.byteSize === evidence.byteSize
              && descriptor.width === evidence.width
              && descriptor.height === evidence.height,
            'PROCESSING_RESULT_ADOPTION_PREVIEW_UNAVAILABLE',
            'The exact processed image preview is unavailable.',
          );
          return operation(Object.freeze({
            schemaVersion: 1,
            mediaType: 'image/png',
            byteSize: evidence.byteSize,
            width: evidence.width,
            height: evidence.height,
            readable,
          }));
        },
      );
    } catch (error) {
      abort(signal);
      const code = expectedReaderErrorCode(error);
      if (code === 'PROCESSING_RESULT_ADOPTION_NOT_FOUND') {
        throw new StudioError(code, 'The selected processing-result adoption does not exist.');
      }
      if (code === 'PROCESSING_RESULT_ADOPTION_PREVIEW_UNAVAILABLE') {
        throw new StudioError(code, 'The exact processed image preview is unavailable.');
      }
      throw new StudioError(
        'PROCESSING_RESULT_ADOPTION_PREVIEW_UNAVAILABLE',
        'The exact processed image preview is unavailable.',
      );
    }
  }
}
